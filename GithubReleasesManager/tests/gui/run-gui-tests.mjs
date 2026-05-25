import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { createServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const captureReview = process.argv.includes("--screenshots");
const reviewDir = resolve(projectRoot, "../.codex-visual-review");
const reviewScreenshots = [];
const layoutReports = [];

async function getFreePort() {
  return await new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

function browserCandidates() {
  return [
    process.env.BROWSER_PATH,
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
}

function findBrowserExecutable() {
  const browserPath = browserCandidates().find((candidate) => existsSync(candidate));
  if (!browserPath) {
    throw new Error("No Chromium-based browser found. Set BROWSER_PATH to run GUI tests.");
  }
  return browserPath;
}

async function waitForDevToolsTarget(port, targetUrl) {
  const deadline = Date.now() + 15000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === "page" && item.url.startsWith(targetUrl));
      if (target?.webSocketDebuggerUrl) {
        return target;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  throw new Error(`Browser DevTools target was not ready: ${lastError?.message ?? "timeout"}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", rejectReady, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const response = new Promise((resolveResponse, rejectResponse) => {
      this.pending.set(id, { resolve: resolveResponse, reject: rejectResponse });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return await response;
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      const message = result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
        ?? "Browser evaluation failed";
      throw new Error(message);
    }

    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function captureScreenshot(cdp, name) {
  if (!captureReview) {
    return;
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  await mkdir(reviewDir, { recursive: true });
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  const filePath = resolve(reviewDir, `${name}.png`);
  await writeFile(filePath, Buffer.from(result.data, "base64"));
  reviewScreenshots.push(filePath);
}

async function captureLayoutReport(cdp, screen) {
  if (!captureReview) {
    return;
  }

  const report = await cdp.evaluate(`(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const overflowing = Array.from(document.querySelectorAll("*"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0
          && rect.height > 0
          && (
            element.scrollWidth > element.clientWidth + 2
            || rect.right > viewportWidth + 2
            || rect.left < -2
          );
      })
      .slice(0, 10)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: String(element.className),
          text: element.textContent.trim().slice(0, 80),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          left: Math.round(rect.left),
          right: Math.round(rect.right)
        };
      });
    const buttons = Array.from(document.querySelectorAll("button")).map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent.trim(),
        disabled: button.disabled,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });
    return { screen: ${JSON.stringify(screen)}, viewportWidth, viewportHeight, overflowing, buttons };
  })()`);
  layoutReports.push(report);
}

async function waitFor(cdp, expression, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cdp.evaluate(expression)) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function removeDirectoryWithRetry(path) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    }
  }

  console.warn(`Warning: could not remove temporary browser profile ${path}: ${lastError.message}`);
}

async function waitForProcessExit(process, timeoutMs = 5000) {
  if (process.exitCode !== null) {
    return;
  }

  await Promise.race([
    once(process, "exit"),
    new Promise((resolveDelay) => setTimeout(resolveDelay, timeoutMs)),
  ]);
}

function textIncludes(text) {
  return `document.body.textContent.includes(${JSON.stringify(text)})`;
}

function clickByText(selector, text) {
  return `(() => {
    const element = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
      .find((candidate) => candidate.textContent.includes(${JSON.stringify(text)}));
    if (!element) {
      throw new Error("Could not find ${selector} containing ${text}");
    }
    element.click();
    return true;
  })()`;
}

async function launchScenario(appUrl, scenario) {
  const browserPath = findBrowserExecutable();
  const debuggingPort = await getFreePort();
  const userDataDir = await mkdtemp(resolve(tmpdir(), "grm-gui-"));
  const url = `${appUrl}?scenario=${scenario}`;
  const browser = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    url,
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  const target = await waitForDevToolsTarget(debuggingPort, url);
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: 900,
    mobile: false,
    width: 1280,
  });
  await waitFor(cdp, "document.readyState === 'complete'", "page load");

  return {
    cdp,
    async cleanup() {
      try {
        await cdp.send("Browser.close");
      } catch {
        // Fall back to process termination below.
      }
      await waitForProcessExit(browser);
      if (browser.exitCode === null && !browser.killed) {
        browser.kill();
      }
      await waitForProcessExit(browser);
      cdp.close();
      await removeDirectoryWithRetry(userDataDir);
    },
  };
}

async function runDownloadFlow(appUrl) {
  const session = await launchScenario(appUrl, "download");
  const { cdp } = session;
  try {
    await waitFor(cdp, textIncludes("Registered Repositories"), "registered repos tab");
    await captureScreenshot(cdp, "01-registered-repos");
    await captureLayoutReport(cdp, "registered repos");
    await cdp.evaluate(clickByText(".repo-card-main", "acme/widget"));
    await waitFor(cdp, textIncludes("Available Versions"), "repository detail");
    await cdp.evaluate(clickByText(".release-item", "v2.0.0"));
    await waitFor(cdp, textIncludes("Available Files"), "version detail");
    await cdp.evaluate(clickByText("button", "Release Notes"));
    await cdp.evaluate(clickByText("button", "Available Files"));
    await waitFor(cdp, textIncludes("widget.exe"), "asset row");
    await captureScreenshot(cdp, "02-version-files-open");
    await captureLayoutReport(cdp, "version files open");
    await cdp.evaluate(clickByText("button", "Download"));
    await waitFor(cdp, textIncludes("Download completed!"), "download success toast");
    await captureScreenshot(cdp, "03-download-success");
    await captureLayoutReport(cdp, "download success");

    const state = await cdp.evaluate("window.__GUI_TEST_MOCKS__");
    assert.equal(state.calls.downloadFile.length, 1);
    assert.equal(state.calls.saveInstalledApp.length, 1);
    assert.equal(
      state.calls.downloadFile[0].filePath,
      "C:\\Chosen\\acme-widget\\widget.exe"
    );
    assert.equal(state.calls.downloadFile[0].url, "https://downloads.example.invalid/widget.exe");
    assert.equal(state.installedApps.some((app) => app.version === "v2.0.0"), true);
  } finally {
    await session.cleanup();
  }
}

async function runUpdateFlow(appUrl) {
  const session = await launchScenario(appUrl, "update");
  const { cdp } = session;
  try {
    await waitFor(cdp, textIncludes("Registered Repositories"), "initial tab");
    await cdp.evaluate(clickByText("button", "Installed Apps"));
    await waitFor(cdp, textIncludes("Installed Applications"), "installed apps tab");
    await waitFor(
      cdp,
      `${textIncludes("v1.0.0")} && ${textIncludes("v2.0.0")}`,
      "update available"
    );
    await captureScreenshot(cdp, "04-installed-update-available");
    await captureLayoutReport(cdp, "installed update available");
    await cdp.evaluate(clickByText("button", "Update"));
    await waitFor(cdp, textIncludes("Select Release Asset"), "asset selection dialog");
    await waitFor(cdp, textIncludes("widget-portable.zip"), "portable asset option");
    await cdp.evaluate(clickByText(".asset-update-option", "widget-portable.zip"));
    await waitFor(cdp, textIncludes("Update completed successfully!"), "update success toast");
    await waitFor(cdp, textIncludes("Up to date"), "up to date status");
    await captureScreenshot(cdp, "05-update-success");
    await captureLayoutReport(cdp, "update success");

    const state = await cdp.evaluate("window.__GUI_TEST_MOCKS__");
    assert.equal(state.calls.createDownloadFile.length, 0);
    assert.equal(state.calls.downloadFile.length, 1);
    assert.equal(state.calls.deleteFile.length, 1);
    assert.equal(state.calls.updateInstalledApp.length, 1);
    assert.equal(
      state.calls.downloadFile[0].filePath,
      "C:\\Chosen\\acme-widget\\widget-portable.zip"
    );
    assert.equal(state.calls.downloadFile[0].url, "https://downloads.example.invalid/widget-portable.zip");
    assert.equal(
      state.calls.deleteFile[0].filePath,
      "C:\\OldDownloads\\acme-widget\\widget-v1.0.0.txt"
    );
    assert.deepEqual(
      state.installedApps.map((app) => app.version),
      ["v2.0.0"]
    );
  } finally {
    await session.cleanup();
  }
}

async function runSelfUpdateFlow(appUrl) {
  const session = await launchScenario(appUrl, "self-update");
  const { cdp } = session;
  try {
    await waitFor(cdp, textIncludes("GitHub Releases Manager 0.2.0 is available"), "self-update banner");
    await captureScreenshot(cdp, "06-self-update-available");
    await captureLayoutReport(cdp, "self-update available");
    await cdp.evaluate(clickByText("button", "Install Update"));
    await waitFor(cdp, textIncludes("Update installed. Restarting..."), "self-update restart toast");

    const state = await cdp.evaluate("window.__GUI_TEST_MOCKS__");
    assert.equal(state.calls.selfUpdateCheck.length >= 1, true);
    assert.equal(state.calls.selfUpdateDownloadAndInstall.length, 1);
    assert.equal(state.calls.relaunch.length, 1);
  } finally {
    await session.cleanup();
  }
}

let server;
try {
  server = await createServer({
    root: projectRoot,
    configFile: resolve(projectRoot, "vite.gui-test.config.ts"),
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
  });
  await server.listen();
  const appUrl = server.resolvedUrls.local[0];

  await runDownloadFlow(appUrl);
  await runUpdateFlow(appUrl);
  await runSelfUpdateFlow(appUrl);

  if (captureReview) {
    await writeFile(
      resolve(reviewDir, "layout-report.json"),
      JSON.stringify(layoutReports, null, 2)
    );
    console.log(`Review screenshots saved:\n${reviewScreenshots.join("\n")}`);
    console.log(`Layout report saved:\n${resolve(reviewDir, "layout-report.json")}`);
  }

  console.log("GUI tests passed: download flow, installed-app update flow, and self-update flow");
} finally {
  await server?.close();
}

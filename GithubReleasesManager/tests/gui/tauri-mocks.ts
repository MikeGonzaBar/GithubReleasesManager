import type { Commit, InstalledApp, RegisteredRepo, Release } from "../../src/types";

interface MockState {
  installedApps: InstalledApp[];
  registeredRepos: RegisteredRepo[];
  releases: Release[];
  commits: Commit[];
  savePaths: string[];
  askResponses: boolean[];
  calls: {
    createDownloadFile: unknown[];
    deleteFile: unknown[];
    downloadFile: unknown[];
    saveInstalledApp: unknown[];
    selfUpdateCheck: unknown[];
    selfUpdateDownloadAndInstall: unknown[];
    updateInstalledApp: unknown[];
    revealItemInDir: unknown[];
    openUrl: unknown[];
    relaunch: unknown[];
  };
}

declare global {
  interface Window {
    __GUI_TEST_MOCKS__?: MockState;
  }
}

function currentScenario(): string {
  if (typeof window === "undefined") {
    return "default";
  }

  return new URLSearchParams(window.location.search).get("scenario") ?? "default";
}

function initialState(): MockState {
  const scenario = currentScenario();

  return {
    installedApps: [
      {
        repo_owner: "acme",
        repo_name: "widget",
        version: "v1.0.0",
        description: "A release asset driven test application",
        download_path: "C:\\OldDownloads\\acme-widget\\widget-v1.0.0.txt",
        installed_date: "2026-01-01T00:00:00.000Z",
      },
    ],
    registeredRepos: [
      {
        owner: "acme",
        name: "widget",
        description: "A release asset driven test application",
        latest_version: "v2.0.0",
        added_date: "2026-01-01T00:00:00.000Z",
        last_checked: "2026-01-01T00:00:00.000Z",
        release_count: 1,
      },
    ],
    releases: [
      {
        id: 200,
        version: "v2.0.0",
        name: "Version 2",
        release_date: "2026-02-01",
        is_prerelease: false,
        is_draft: false,
        description: "## Changes\n\n- New GUI-tested release.",
        assets: [
          {
            id: 901,
            name: "widget.exe",
            size: 2048,
            size_formatted: "2.00 KB",
            url: "https://downloads.example.invalid/widget.exe",
            content_type: "application/octet-stream",
          },
          {
            id: 902,
            name: "widget-portable.zip",
            size: 4096,
            size_formatted: "4.00 KB",
            url: "https://downloads.example.invalid/widget-portable.zip",
            content_type: "application/zip",
          },
        ],
      },
    ],
    commits: [
      {
        sha: "abc1234",
        message: "Ship v2",
        author: "tester",
        date: "2026-02-01",
      },
    ],
    savePaths: scenario === "update"
      ? ["C:\\Chosen\\widget-portable.zip"]
      : ["C:\\Chosen\\widget.exe"],
    askResponses: [true],
    calls: {
      createDownloadFile: [],
      deleteFile: [],
      downloadFile: [],
      saveInstalledApp: [],
      selfUpdateCheck: [],
      selfUpdateDownloadAndInstall: [],
      updateInstalledApp: [],
      revealItemInDir: [],
      openUrl: [],
      relaunch: [],
    },
  };
}

const state = initialState();

if (typeof window !== "undefined") {
  window.__GUI_TEST_MOCKS__ = state;
}

export async function invoke<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  switch (command) {
    case "load_installed_apps":
      return structuredClone(state.installedApps) as T;
    case "load_registered_repos":
      return structuredClone(state.registeredRepos) as T;
    case "fetch_github_releases":
      return structuredClone(state.releases) as T;
    case "fetch_release_commits":
      return structuredClone(state.commits) as T;
    case "update_repo_last_checked":
      return undefined as T;
    case "download_file":
      state.calls.downloadFile.push(structuredClone(args));
      return args.filePath as T;
    case "create_download_file":
      state.calls.createDownloadFile.push(structuredClone(args));
      return args.filePath as T;
    case "delete_file":
      state.calls.deleteFile.push(structuredClone(args));
      return undefined as T;
    case "save_installed_app": {
      state.calls.saveInstalledApp.push(structuredClone(args));
      const installedApp = args.installedApp as InstalledApp;
      const exists = state.installedApps.some((app) => (
        app.repo_owner === installedApp.repo_owner
        && app.repo_name === installedApp.repo_name
        && app.version === installedApp.version
      ));
      if (!exists) {
        state.installedApps.push(structuredClone(installedApp));
      }
      return undefined as T;
    }
    case "update_installed_app": {
      state.calls.updateInstalledApp.push(structuredClone(args));
      const repoOwner = args.repoOwner as string;
      const repoName = args.repoName as string;
      const oldVersion = args.oldVersion as string;
      const newInstalledApp = args.newInstalledApp as InstalledApp;
      state.installedApps = state.installedApps.filter((app) => !(
        app.repo_owner === repoOwner
        && app.repo_name === repoName
        && app.version === oldVersion
      ));
      state.installedApps.push(structuredClone(newInstalledApp));
      return undefined as T;
    }
    case "delete_installed_app": {
      const repoOwner = args.repoOwner as string;
      const repoName = args.repoName as string;
      const version = args.version as string;
      state.installedApps = state.installedApps.filter((app) => !(
        app.repo_owner === repoOwner
        && app.repo_name === repoName
        && app.version === version
      ));
      return undefined as T;
    }
    default:
      throw new Error(`Unhandled GUI test invoke command: ${command}`);
  }
}

export async function save(): Promise<string | null> {
  return state.savePaths.shift() ?? null;
}

export async function ask(): Promise<boolean> {
  return state.askResponses.shift() ?? false;
}

export async function revealItemInDir(path: string): Promise<void> {
  state.calls.revealItemInDir.push({ path });
}

export async function openUrl(url: string): Promise<void> {
  state.calls.openUrl.push({ url });
}

export async function check(): Promise<unknown | null> {
  state.calls.selfUpdateCheck.push({});

  if (currentScenario() !== "self-update") {
    return null;
  }

  return {
    available: true,
    currentVersion: "0.1.0",
    version: "0.2.0",
    date: "2026-05-25",
    body: "Self-update test release.",
    rawJson: {},
    async downloadAndInstall(onEvent?: (event: unknown) => void) {
      state.calls.selfUpdateDownloadAndInstall.push({});
      onEvent?.({ event: "Started", data: { contentLength: 200 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 120 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 80 } });
      onEvent?.({ event: "Finished" });
    },
    async close() {
      return undefined;
    },
  };
}

export async function relaunch(): Promise<void> {
  state.calls.relaunch.push({});
}

export async function listen(): Promise<() => void> {
  return () => undefined;
}

export {};

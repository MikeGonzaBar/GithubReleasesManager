import { useCallback, useEffect, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import "./App.css";
import TabNavigation from "./shared/components/TabNavigation";
import { ToastProvider, useToast } from "./shared/components/ToastContainer";
import RegisteredRepos from "./tabs/registered-repos/components/RegisteredRepos";
import InstalledApps from "./tabs/installed-apps/components/InstalledApps";
import About from "./tabs/about/components/About";
import { getErrorMessage } from "./shared/utils/errorHandler";

type Tab = "repos" | "installed" | "about";
type SelfUpdateStatus = "idle" | "available" | "downloading" | "restarting";

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("repos");
  const [selfUpdate, setSelfUpdate] = useState<Update | null>(null);
  const [selfUpdateStatus, setSelfUpdateStatus] = useState<SelfUpdateStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function checkForSelfUpdate() {
      try {
        const update = await check();

        if (cancelled || !update) {
          return;
        }

        setSelfUpdate(update);
        setSelfUpdateStatus("available");
      } catch (error) {
        console.info("Self-update check was skipped or failed.", error);
      }
    }

    void checkForSelfUpdate();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismissSelfUpdate = useCallback(() => {
    if (selfUpdate) {
      void selfUpdate.close().catch((error) => {
        console.info("Failed to close updater resource.", error);
      });
    }

    setSelfUpdate(null);
    setSelfUpdateStatus("idle");
    setDownloadProgress(null);
  }, [selfUpdate]);

  const installSelfUpdate = useCallback(async () => {
    if (!selfUpdate || selfUpdateStatus === "downloading" || selfUpdateStatus === "restarting") {
      return;
    }

    let totalBytes = 0;
    let downloadedBytes = 0;

    setSelfUpdateStatus("downloading");
    setDownloadProgress(null);

    try {
      await selfUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          setDownloadProgress(totalBytes > 0 ? 0 : null);
          return;
        }

        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;

          if (totalBytes > 0) {
            setDownloadProgress(Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)));
          }
          return;
        }

        setDownloadProgress(100);
      });
    } catch (error) {
      setSelfUpdateStatus("available");
      setDownloadProgress(null);
      showToast(getErrorMessage(error, "Failed to install update."), "error", 8000);
      return;
    }

    setSelfUpdateStatus("restarting");
    showToast("Update installed. Restarting...", "success", 5000);

    try {
      await relaunch();
    } catch (error) {
      console.info("Self-update relaunch failed.", error);
      showToast("Update installed. Restart the app to finish.", "info", 8000);
    }
  }, [selfUpdate, selfUpdateStatus, showToast]);

  const selfUpdateActionLabel = selfUpdateStatus === "downloading"
    ? downloadProgress === null
      ? "Downloading..."
      : `Downloading ${downloadProgress}%`
    : selfUpdateStatus === "restarting"
      ? "Restarting..."
      : "Install Update";

  return (
    <div className="app-container">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      {selfUpdate && (
        <section className="self-update-banner" role="status" aria-live="polite">
          <div className="self-update-copy">
            <strong>GitHub Releases Manager {selfUpdate.version} is available</strong>
            <span>Your tracked repositories and installed app records stay in app data after updating.</span>
          </div>
          <div className="self-update-actions">
            <button
              type="button"
              className="self-update-primary"
              disabled={selfUpdateStatus === "downloading" || selfUpdateStatus === "restarting"}
              onClick={installSelfUpdate}
            >
              {selfUpdateActionLabel}
            </button>
            <button
              type="button"
              className="self-update-secondary"
              disabled={selfUpdateStatus === "downloading" || selfUpdateStatus === "restarting"}
              onClick={dismissSelfUpdate}
            >
              Later
            </button>
          </div>
        </section>
      )}
      <main className="app-content">
        {activeTab === "repos" && <RegisteredRepos />}
        {activeTab === "installed" && <InstalledApps />}
        {activeTab === "about" && <About />}
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

export default App;

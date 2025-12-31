import { useState, useEffect } from "react";
import { save, ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import "./InstalledApps.css";
import { loadInstalledApps, saveInstalledApp } from "../../../shared/utils/storage";
import { loadRegisteredRepos, isVersionNewer } from "../../../shared/utils/repos";
import { getSuggestedDownloadPath, ensureFolderStructure } from "../../../shared/utils/download";
import type { InstalledApp, RegisteredRepo } from "../../../types";

export default function InstalledApps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [registeredRepos, setRegisteredRepos] = useState<RegisteredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadApps = async () => {
    try {
      setLoading(true);
      const [installedApps, repos] = await Promise.all([
        loadInstalledApps(),
        loadRegisteredRepos()
      ]);
      setApps(installedApps);
      setRegisteredRepos(repos);
    } catch (error) {
      console.error("Failed to load installed apps:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (app: InstalledApp, latestVersion: string) => {
    try {
      setUpdating(`${app.repo_owner}/${app.repo_name}`);

      // Get the registered repo to get description
      const registeredRepo = registeredRepos.find(
        r => r.owner === app.repo_owner && r.name === app.repo_name
      );
      if (!registeredRepo) {
        alert("Repository not found in registered repos.");
        return;
      }

      // Generate suggested path with folder structure: {owner}-{repo}/{filename}-{version}.txt
      const defaultFileName = `${app.repo_name}-${latestVersion}.txt`;
      const suggestedPath = getSuggestedDownloadPath(
        app.repo_owner,
        app.repo_name,
        defaultFileName,
        latestVersion
      );

      // Open file save dialog with suggested folder structure
      const newFilePath = await save({
        defaultPath: suggestedPath,
        filters: [{
          name: "Text Files",
          extensions: ["txt"]
        }]
      });

      if (!newFilePath) {
        // User cancelled
        setUpdating(null);
        return;
      }

      // Ensure folder structure is always used, even if user changed the path
      const finalPath = ensureFolderStructure(
        newFilePath,
        app.repo_owner,
        app.repo_name
      );

      // Create the new download file
      await invoke<string>("create_download_file", {
        filePath: finalPath,
        repoOwner: app.repo_owner,
        repoName: app.repo_name,
        version: latestVersion,
        fileName: defaultFileName,
      });

      // Create new installed app entry
      const newInstalledApp: InstalledApp = {
        repo_owner: app.repo_owner,
        repo_name: app.repo_name,
        version: latestVersion,
        description: registeredRepo.description,
        download_path: finalPath,
        installed_date: new Date().toISOString(),
      };

      // Ask user what to do with old file
      const oldFilePath = app.download_path;
      const shouldDelete = await ask(
        `Update completed!\n\nNew version saved to:\n${finalPath}\n\nDo you want to delete the old file?\n${oldFilePath}\n\nClick "Yes" to delete, "No" to keep both.`,
        {
          title: "Update Complete",
          kind: "info",
          okLabel: "Delete Old File",
          cancelLabel: "Keep Both",
        }
      );

      if (shouldDelete) {
        // User chose to delete old file
        try {
          await invoke("delete_file", { filePath: oldFilePath });
          // Update the installed app record (replace old with new)
          await invoke("update_installed_app", {
            repoOwner: app.repo_owner,
            repoName: app.repo_name,
            oldVersion: app.version,
            newInstalledApp: newInstalledApp,
          });
        } catch (error) {
          console.error("Failed to delete old file:", error);
          // Still save the new app even if deletion fails
          await saveInstalledApp(newInstalledApp);
          alert(`Update saved, but failed to delete old file: ${error}`);
        }
      } else {
        // User chose to keep both - just add new entry
        await saveInstalledApp(newInstalledApp);
      }

      // Reload apps to show updated list
      await loadApps();

      alert("Update completed successfully!");
    } catch (error) {
      console.error("Update failed:", error);
      alert(`Update failed: ${error}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (app: InstalledApp) => {
    const confirmDelete = await ask(
      `Are you sure you want to delete this installed app?\n\n${app.repo_owner}/${app.repo_name} (${app.version})\n\nThis will delete the file and remove it from your installed apps list.`,
      {
        title: "Delete Installed App",
        kind: "warning",
        okLabel: "Delete",
        cancelLabel: "Cancel",
      }
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setDeleting(`${app.repo_owner}/${app.repo_name}-${app.version}`);

      await invoke("delete_installed_app", {
        repoOwner: app.repo_owner,
        repoName: app.repo_name,
        version: app.version,
      });

      // Reload apps to show updated list
      await loadApps();

      alert("App deleted successfully!");
    } catch (error) {
      console.error("Delete failed:", error);
      alert(`Failed to delete app: ${error}`);
    } finally {
      setDeleting(null);
    }
  };

  // Load apps when component mounts
  useEffect(() => {
    loadApps();
  }, []);

  return (
    <div className="tab-content installed-apps">
      <div className="content-header">
        <h2>Installed Applications</h2>
        <button className="refresh-button" onClick={loadApps} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="apps-list">
        {loading ? (
          <div className="empty-state">
            <p>Loading installed applications...</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <p>No installed applications found.</p>
            <p className="empty-state-hint">Applications you download will appear here.</p>
          </div>
        ) : (
          apps.map((app, index) => {
            // Find the registered repo to get latest version
            const registeredRepo = registeredRepos.find(
              r => r.owner === app.repo_owner && r.name === app.repo_name
            );
            const latestVersion = registeredRepo?.latest_version || app.version;
            const hasUpdate = registeredRepo
              ? isVersionNewer(registeredRepo.latest_version, app.version)
              : false;
            const versionsMatch = app.version === latestVersion;

            return (
              <div key={index} className="app-card">
                <div className="app-info">
                  <h3 className="app-name">{app.repo_owner}/{app.repo_name}</h3>
                  {app.description && (
                    <p className="app-description">{app.description}</p>
                  )}
                  <div className="version-info">
                    <span className="version-label">Installed:</span>
                    <span className="version-value">{app.version}</span>
                    {!versionsMatch && (
                      <>
                        <span className="version-separator">→</span>
                        <span className="version-label">Latest:</span>
                        <span className="version-value">{latestVersion}</span>
                      </>
                    )}
                  </div>
                  <p className="download-path">Location: {app.download_path}</p>
                </div>
                <div className="app-actions">
                  <div className="action-buttons">
                    {hasUpdate ? (
                      <button
                        className="update-button"
                        onClick={() => handleUpdate(app, latestVersion)}
                        disabled={updating === `${app.repo_owner}/${app.repo_name}` || deleting === `${app.repo_owner}/${app.repo_name}-${app.version}`}
                      >
                        {updating === `${app.repo_owner}/${app.repo_name}` ? "Updating..." : "Update"}
                      </button>
                    ) : (
                      <span className="status-text">Up to date</span>
                    )}
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(app)}
                      disabled={updating === `${app.repo_owner}/${app.repo_name}` || deleting === `${app.repo_owner}/${app.repo_name}-${app.version}`}
                      title="Delete this installed app"
                    >
                      {deleting === `${app.repo_owner}/${app.repo_name}-${app.version}` ? "Deleting..." : "🗑️"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


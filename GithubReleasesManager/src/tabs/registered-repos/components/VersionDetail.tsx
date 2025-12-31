import { useState, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./VersionDetail.css";
import { saveInstalledApp } from "../../../shared/utils/storage";
import { getSuggestedDownloadPath, ensureFolderStructure } from "../../../shared/utils/download";
import { fetchReleaseCommits } from "../../../shared/utils/github";
import type { InstalledApp, Release, Commit, ReleaseAsset, RegisteredRepo } from "../../../types";

interface VersionDetailProps {
  repository: RegisteredRepo;
  release: Release;
  onBack: () => void;
}

interface DownloadProgress {
  file_name: string;
  downloaded: number;
  total: number;
  progress: number;
}

export default function VersionDetail({ repository, release, onBack }: VersionDetailProps) {
  const [commitsOpen, setCommitsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: DownloadProgress }>({});
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  // Listen for download progress events
  useEffect(() => {
    const setupProgressListener = async () => {
      const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
        const progress = event.payload;
        setDownloadProgress((prev) => ({
          ...prev,
          [progress.file_name]: progress,
        }));
      });
      return unlisten;
    };

    let unlistenFn: (() => void) | undefined;
    setupProgressListener().then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Fetch commits when commits section is opened
  useEffect(() => {
    if (commitsOpen && commits.length === 0 && !commitsLoading && !commitsError) {
      loadCommits();
    }
  }, [commitsOpen]);

  const loadCommits = async () => {
    try {
      setCommitsLoading(true);
      setCommitsError(null);
      const fetchedCommits = await fetchReleaseCommits(
        repository.owner,
        repository.name,
        release.version
      );
      setCommits(fetchedCommits);
    } catch (err) {
      setCommitsError(err instanceof Error ? err.message : "Failed to load commits");
    } finally {
      setCommitsLoading(false);
    }
  };

  // Use assets from the release object
  const downloadFiles: ReleaseAsset[] = release.assets || [];

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleDownload = async (asset: ReleaseAsset) => {
    try {
      setDownloading(asset.name);
      setDownloadProgress((prev) => ({
        ...prev,
        [asset.name]: { file_name: asset.name, downloaded: 0, total: asset.size, progress: 0 },
      }));

      // Get file extension from asset name
      const fileExtension = asset.name.split('.').pop() || '';
      const suggestedPath = getSuggestedDownloadPath(
        repository.owner,
        repository.name,
        asset.name,
        release.version
      );

      // Open file save dialog
      const filePath = await save({
        defaultPath: suggestedPath,
        filters: fileExtension ? [{
          name: "All Files",
          extensions: [fileExtension]
        }] : undefined
      });

      if (!filePath) {
        // User cancelled
        setDownloading(null);
        setDownloadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[asset.name];
          return newProgress;
        });
        return;
      }

      // Ensure folder structure is always used, even if user changed the path
      const finalPath = ensureFolderStructure(
        filePath,
        repository.owner,
        repository.name
      );

      // Download the actual file with progress tracking
      await invoke<string>("download_file", {
        url: asset.url,
        filePath: finalPath,
        fileName: asset.name,
      });

      // Save installed app information
      const installedApp: InstalledApp = {
        repo_owner: repository.owner,
        repo_name: repository.name,
        version: release.version,
        description: repository.description,
        download_path: finalPath,
        installed_date: new Date().toISOString(),
      };

      await saveInstalledApp(installedApp);

      // Clear progress
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[asset.name];
        return newProgress;
      });

      alert(`Download completed! File saved to: ${finalPath}`);
    } catch (error) {
      console.error("Download failed:", error);
      alert(`Download failed: ${error}`);
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[asset.name];
        return newProgress;
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="version-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="version-header-info">
          <h2 className="detail-title">{repository.owner}/{repository.name}</h2>
          <span className="version-tag">{release.version}</span>
        </div>
      </div>

      <div className="detail-content">
        <div className="version-sections">
          <section className="version-section">
            <button
              className="section-header"
              onClick={() => setCommitsOpen(!commitsOpen)}
            >
              <h3 className="section-title">Commit Changes</h3>
              <span className={`section-chevron ${commitsOpen ? "open" : ""}`}>▼</span>
            </button>
            <div className={`section-content ${commitsOpen ? "open" : ""}`}>
              <div className="commits-list">
                {commitsLoading ? (
                  <p className="empty-message">Loading commits...</p>
                ) : commitsError ? (
                  <p className="empty-message error">{commitsError}</p>
                ) : commits.length === 0 ? (
                  <p className="empty-message">No commit information available.</p>
                ) : (
                  commits.map((commit, index) => (
                    <div key={`${commit.sha}-${index}`} className="commit-item">
                      <div className="commit-header">
                        <span className="commit-hash">{commit.sha}</span>
                        <span className="commit-author">by {commit.author}</span>
                        <span className="commit-date">{commit.date}</span>
                      </div>
                      <p className="commit-message">{commit.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="version-section">
            <button
              className="section-header"
              onClick={() => setDownloadsOpen(!downloadsOpen)}
            >
              <h3 className="section-title">Available Files</h3>
              <span className={`section-chevron ${downloadsOpen ? "open" : ""}`}>▼</span>
            </button>
            <div className={`section-content ${downloadsOpen ? "open" : ""}`}>
              <div className="downloads-list">
                {downloadFiles.length === 0 ? (
                  <p className="empty-message">No files available for download.</p>
                ) : (
                  downloadFiles.map((asset) => {
                    const progress = downloadProgress[asset.name];
                    const isDownloading = downloading === asset.name;

                    return (
                      <div key={asset.id} className="download-item">
                        <div className="file-info">
                          <span className="file-name">{asset.name}</span>
                          <span className="file-size">{asset.size_formatted}</span>
                          {isDownloading && progress && (
                            <div className="download-progress-container">
                              <div className="download-progress-bar">
                                <div
                                  className="download-progress-fill"
                                  style={{ '--progress': `${progress.progress}%` } as React.CSSProperties}
                                />
                              </div>
                              <span className="download-progress-text">
                                {progress.progress}% ({formatBytes(progress.downloaded)} / {formatBytes(progress.total)})
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          className="download-button"
                          onClick={() => handleDownload(asset)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? "Downloading..." : "Download"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


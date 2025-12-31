import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import "./VersionDetail.css";
import { saveInstalledApp } from "../../../shared/utils/storage";
import { getSuggestedDownloadPath, ensureFolderStructure } from "../../../shared/utils/download";
import { fetchReleaseCommits } from "../../../shared/utils/github";
import { formatBytes } from "../../../shared/utils/format";
import { getErrorMessage } from "../../../shared/utils/errorHandler";
import { useToast } from "../../../shared/components/ToastContainer";
import { useDownloadProgress, type DownloadProgress } from "../../../shared/hooks/useDownloadProgress";
import { ReleaseNotesViewer } from "../../../shared/components/ReleaseNotesViewer";
import { QuickActions } from "../../../shared/components/QuickActions";
import type { InstalledApp, Release, Commit, ReleaseAsset, RegisteredRepo } from "../../../types";

interface VersionDetailProps {
  repository: RegisteredRepo;
  release: Release;
  onBack: () => void;
}

// Progress bar component - memoized to prevent unnecessary re-renders
const ProgressBar = React.memo(function ProgressBar({ progress }: { progress: DownloadProgress }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--progress', `${progress.progress}%`);
    }
  }, [progress.progress]);

  return (
    <div ref={containerRef} className="download-progress-container">
      <div className="download-progress-bar">
        <div className="download-progress-fill" />
      </div>
      <span className="download-progress-text">
        {progress.progress}% ({formatBytes(progress.downloaded)} / {formatBytes(progress.total)})
      </span>
    </div>
  );
});

export default function VersionDetail({ repository, release, onBack }: VersionDetailProps) {
  const [commitsOpen, setCommitsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { downloading, setDownloading, downloadProgress, clearProgress } = useDownloadProgress();

  const loadCommits = useCallback(async () => {
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
      const errorMessage = getErrorMessage(err, "Failed to load commits");
      setCommitsError(errorMessage);
    } finally {
      setCommitsLoading(false);
    }
  }, [repository.owner, repository.name, release.version]);

  // Fetch commits when commits section is opened
  useEffect(() => {
    if (commitsOpen && commits.length === 0 && !commitsLoading && !commitsError) {
      loadCommits();
    }
  }, [commitsOpen, commits.length, commitsLoading, commitsError, loadCommits]);

  // Use assets from the release object
  const downloadFiles: ReleaseAsset[] = useMemo(() => release.assets || [], [release.assets]);

  const handleDownload = useCallback(async (asset: ReleaseAsset) => {
    try {
      setDownloading(asset.name);
      // Progress will be set by the event listener

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
        clearProgress(asset.name);
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
      clearProgress(asset.name);

      showToast(`Download completed! File saved to: ${finalPath}`, "success", 5000);
    } catch (error) {
      console.error("Download failed:", error);
      const errorMessage = getErrorMessage(error, "Download failed");
      showToast(errorMessage, "error");
      clearProgress(asset.name);
    } finally {
      setDownloading(null);
    }
  }, [repository, release, showToast, clearProgress]);

  return (
    <div className="version-detail">
      <div className="detail-header">
        <button type="button" className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="version-header-info">
          <h2 className="detail-title">{repository.owner}/{repository.name}</h2>
          <span className="version-tag">{release.version}</span>
        </div>
        <QuickActions
          repoOwner={repository.owner}
          repoName={repository.name}
          version={release.version}
          onCopy={() => showToast("Copied to clipboard!", "success", 2000)}
        />
      </div>

      <div className="detail-content">
        <div className="version-sections">
          <section className="version-section">
            <button
              type="button"
              className="section-header"
              onClick={() => setReleaseNotesOpen(!releaseNotesOpen)}
            >
              <h3 className="section-title">Release Notes</h3>
              <span className={`section-chevron ${releaseNotesOpen ? "open" : ""}`}>▼</span>
            </button>
            <div className={`section-content ${releaseNotesOpen ? "open" : ""}`}>
              <ReleaseNotesViewer content={release.description} />
            </div>
          </section>

          <section className="version-section">
            <button
              type="button"
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
              type="button"
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
                          {isDownloading && progress && <ProgressBar progress={progress} />}
                        </div>
                        <button
                          type="button"
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


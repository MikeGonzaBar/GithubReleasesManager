import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import "./VersionDetail.css";
import { saveInstalledApp } from "../../../shared/utils/storage";
import { getSuggestedDownloadPath, ensureFolderStructure } from "../../../shared/utils/download";
import type { InstalledApp } from "../../../types";

interface Release {
  id: number;
  version: string;
  releaseDate: string;
  isPrerelease: boolean;
  isDraft: boolean;
}

interface Repository {
  id: number;
  owner: string;
  name: string;
  latestVersion: string;
  description: string | null;
}

interface VersionDetailProps {
  repository: Repository;
  release: Release;
  onBack: () => void;
}

export default function VersionDetail({ repository, release, onBack }: VersionDetailProps) {
  const [commitsOpen, setCommitsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  // Dummy data for commit changes and download files
  const commitChanges = [
    {
      hash: "a1b2c3d",
      message: "Fix critical bug in authentication system",
      author: "developer1",
      date: "2024-01-14",
    },
    {
      hash: "e4f5g6h",
      message: "Add new feature for user preferences",
      author: "developer2",
      date: "2024-01-13",
    },
    {
      hash: "i7j8k9l",
      message: "Update dependencies and improve performance",
      author: "developer1",
      date: "2024-01-12",
    },
  ];

  const downloadFiles = [
    {
      name: "app-windows-x64.exe",
      size: "15.2 MB",
      type: "executable",
      url: "https://example.com/downloads/app-windows-x64.exe", // Placeholder - replace with real GitHub release asset URL
    },
    {
      name: "app-linux-x64.tar.gz",
      size: "12.8 MB",
      type: "archive",
      url: "https://example.com/downloads/app-linux-x64.tar.gz",
    },
    {
      name: "app-macos-x64.dmg",
      size: "14.5 MB",
      type: "disk-image",
      url: "https://example.com/downloads/app-macos-x64.dmg",
    },
    {
      name: "source-code.zip",
      size: "8.3 MB",
      type: "source",
      url: "https://example.com/downloads/source-code.zip",
    },
  ];

  const handleDownload = async (fileName: string) => {
    try {
      setDownloading(fileName);
      
      // Generate suggested path with folder structure: {owner}-{repo}/{filename}-{version}.txt
      const defaultFileName = fileName.replace(/\.[^/.]+$/, "") + ".txt";
      const suggestedPath = getSuggestedDownloadPath(
        repository.owner,
        repository.name,
        defaultFileName,
        release.version
      );
      
      // Open file save dialog with suggested folder structure
      const filePath = await save({
        defaultPath: suggestedPath,
        filters: [{
          name: "Text Files",
          extensions: ["txt"]
        }]
      });

      if (!filePath) {
        // User cancelled
        setDownloading(null);
        return;
      }

      // Ensure folder structure is always used, even if user changed the path
      const finalPath = ensureFolderStructure(
        filePath,
        repository.owner,
        repository.name
      );

      // Create the text file with download information
      await invoke<string>("create_download_file", {
        filePath: finalPath,
        repoOwner: repository.owner,
        repoName: repository.name,
        version: release.version,
        fileName: fileName,
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

      alert(`Download completed! File saved to: ${finalPath}`);
    } catch (error) {
      console.error("Download failed:", error);
      alert(`Download failed: ${error}`);
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
                {commitChanges.length === 0 ? (
                  <p className="empty-message">No commit information available.</p>
                ) : (
                  commitChanges.map((commit, index) => (
                    <div key={index} className="commit-item">
                      <div className="commit-header">
                        <span className="commit-hash">{commit.hash.substring(0, 7)}</span>
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
                  downloadFiles.map((file, index) => (
                    <div key={index} className="download-item">
                      <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{file.size}</span>
                      </div>
                      <button
                        className="download-button"
                        onClick={() => handleDownload(file.name)}
                        disabled={downloading === file.name}
                      >
                        {downloading === file.name ? "Downloading..." : "Download"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


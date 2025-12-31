import { useState, useEffect, useCallback } from "react";
import "./InstalledAppDetail.css";
import { fetchReleaseCommits, fetchReleases } from "../../../shared/utils/github";
import { getErrorMessage } from "../../../shared/utils/errorHandler";
import { useToast } from "../../../shared/components/ToastContainer";
import { ReleaseNotesViewer } from "../../../shared/components/ReleaseNotesViewer";
import { QuickActions } from "../../../shared/components/QuickActions";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { InstalledApp, Commit, Release } from "../../../types";

interface InstalledAppDetailProps {
    app: InstalledApp;
    onBack: () => void;
}

export default function InstalledAppDetail({ app, onBack }: InstalledAppDetailProps) {
    const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
    const [commitsOpen, setCommitsOpen] = useState(false);
    const [commits, setCommits] = useState<Commit[]>([]);
    const [commitsLoading, setCommitsLoading] = useState(false);
    const [commitsError, setCommitsError] = useState<string | null>(null);
    const [release, setRelease] = useState<Release | null>(null);
    const { showToast } = useToast();

    // Fetch release details for this version
    useEffect(() => {
        const loadRelease = async () => {
            try {
                const releases = await fetchReleases(app.repo_owner, app.repo_name);
                // Try to match by version
                const matchingRelease = releases.find(r => r.version === app.version);
                setRelease(matchingRelease || null);
            } catch (error) {
                console.error("Failed to load release:", error);
            }
        };

        loadRelease();
    }, [app.repo_owner, app.repo_name, app.version]);

    const loadCommits = useCallback(async () => {
        try {
            setCommitsLoading(true);
            setCommitsError(null);
            const fetchedCommits = await fetchReleaseCommits(
                app.repo_owner,
                app.repo_name,
                app.version
            );
            setCommits(fetchedCommits);
        } catch (err) {
            const errorMessage = getErrorMessage(err, "Failed to load commits");
            setCommitsError(errorMessage);
        } finally {
            setCommitsLoading(false);
        }
    }, [app.repo_owner, app.repo_name, app.version]);

    // Fetch commits when commits section is opened
    useEffect(() => {
        if (commitsOpen && commits.length === 0 && !commitsLoading && !commitsError) {
            loadCommits();
        }
    }, [commitsOpen, commits.length, commitsLoading, commitsError, loadCommits]);

    const handleOpenPath = useCallback(async () => {
        try {
            await revealItemInDir(app.download_path);
        } catch (error) {
            console.error("Failed to open file path:", error);
            const errorMessage = getErrorMessage(error, "Failed to open file location");
            showToast(errorMessage, "error");
        }
    }, [app.download_path, showToast]);

    return (
        <div className="installed-app-detail">
            <div className="detail-header">
                <button type="button" className="back-button" onClick={onBack}>
                    ← Back
                </button>
                <div className="version-header-info">
                    <h2 className="detail-title">{app.repo_owner}/{app.repo_name}</h2>
                    <span className="version-tag">{app.version}</span>
                </div>
                <QuickActions
                    repoOwner={app.repo_owner}
                    repoName={app.repo_name}
                    version={app.version}
                    onCopy={() => showToast("Copied to clipboard!", "success", 2000)}
                />
            </div>

            <div className="detail-content">
                <div className="app-info-section">
                    <div className="info-row">
                        <span className="info-label">Installed Date:</span>
                        <span className="info-value">
                            {new Date(app.installed_date).toLocaleDateString()}
                        </span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">File Location:</span>
                        <div className="path-container">
                            <span className="info-value path-value">{app.download_path}</span>
                            <button
                                type="button"
                                className="open-path-button"
                                onClick={handleOpenPath}
                                title="Open file location in file explorer"
                                aria-label="Open file location"
                            >
                                📂
                            </button>
                        </div>
                    </div>
                    {app.description && (
                        <div className="info-row">
                            <span className="info-label">Description:</span>
                            <span className="info-value">{app.description}</span>
                        </div>
                    )}
                </div>

                <div className="version-sections">
                    {release && (
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
                    )}

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
                </div>
            </div>
        </div>
    );
}


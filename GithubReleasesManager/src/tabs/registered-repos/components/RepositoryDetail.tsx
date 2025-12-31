import { useState, useEffect } from "react";
import "./RepositoryDetail.css";
import VersionDetail from "./VersionDetail";
import { fetchReleases } from "../../../shared/utils/github";
import type { Release, RegisteredRepo } from "../../../types";

interface RepositoryDetailProps {
  repository: RegisteredRepo;
  onBack: () => void;
}

export default function RepositoryDetail({ repository, onBack }: RepositoryDetailProps) {
  const [selectedVersion, setSelectedVersion] = useState<Release | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReleases();
  }, [repository.owner, repository.name]);

  const loadReleases = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedReleases = await fetchReleases(repository.owner, repository.name);
      // Sort by date (newest first) - releases are already sorted by GitHub API, but filter out drafts
      const sortedReleases = fetchedReleases
        .filter((r) => !r.is_draft) // Hide draft releases from main list
        .sort((a, b) => {
          // Sort by date descending (newest first)
          return b.release_date.localeCompare(a.release_date);
        });
      setReleases(sortedReleases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases");
    } finally {
      setLoading(false);
    }
  };

  if (selectedVersion) {
    return (
      <VersionDetail
        repository={repository}
        release={selectedVersion}
        onBack={() => setSelectedVersion(null)}
      />
    );
  }

  return (
    <div className="repository-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h2 className="detail-title">{repository.owner}/{repository.name}</h2>
      </div>

      <div className="detail-content">
        <h3 className="section-title">Available Versions</h3>

        {loading ? (
          <div className="empty-state">
            <p>Loading releases...</p>
          </div>
        ) : error ? (
          <div className="empty-state error">
            <p>{error}</p>
          </div>
        ) : (
          <div className="releases-list">
            {releases.length === 0 ? (
              <div className="empty-state">
                <p>No releases available for this repository.</p>
              </div>
            ) : (
              releases.map((release) => (
                <div
                  key={release.id}
                  className="release-item"
                  onClick={() => setSelectedVersion(release)}
                >
                  <div className="release-info">
                    <div className="release-version-row">
                      <span className="release-version">{release.version}</span>
                      {release.is_prerelease && (
                        <span className="release-badge prerelease">Pre-release</span>
                      )}
                      {release.is_draft && (
                        <span className="release-badge draft">Draft</span>
                      )}
                    </div>
                    <span className="release-date">Released: {release.release_date}</span>
                  </div>
                  <span className="release-arrow">→</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}


import { useState } from "react";
import "./RepositoryDetail.css";
import VersionDetail from "./VersionDetail";

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

interface RepositoryDetailProps {
  repository: Repository;
  onBack: () => void;
}

export default function RepositoryDetail({ repository, onBack }: RepositoryDetailProps) {
  const [selectedVersion, setSelectedVersion] = useState<Release | null>(null);

  // Dummy releases data
  const releases: Release[] = [
    {
      id: 1,
      version: "v1.2.3",
      releaseDate: "2024-01-15",
      isPrerelease: false,
      isDraft: false,
    },
    {
      id: 2,
      version: "v1.2.2",
      releaseDate: "2024-01-10",
      isPrerelease: false,
      isDraft: false,
    },
    {
      id: 3,
      version: "v1.2.1",
      releaseDate: "2024-01-05",
      isPrerelease: false,
      isDraft: false,
    },
    {
      id: 4,
      version: "v1.2.0-beta",
      releaseDate: "2024-01-01",
      isPrerelease: true,
      isDraft: false,
    },
  ];

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
                    {release.isPrerelease && (
                      <span className="release-badge prerelease">Pre-release</span>
                    )}
                    {release.isDraft && (
                      <span className="release-badge draft">Draft</span>
                    )}
                  </div>
                  <span className="release-date">Released: {release.releaseDate}</span>
                </div>
                <span className="release-arrow">→</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


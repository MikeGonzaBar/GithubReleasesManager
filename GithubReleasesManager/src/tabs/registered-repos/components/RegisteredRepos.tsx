import { useState } from "react";
import "./RegisteredRepos.css";
import RepositoryDetail from "./RepositoryDetail";
import { getRegisteredRepos } from "../../../shared/utils/repos";

export default function RegisteredRepos() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<{
    id: number;
    owner: string;
    name: string;
    latestVersion: string;
    description: string | null;
  } | null>(null);

  // Get registered repos from shared utility
  const repos = getRegisteredRepos();

  if (selectedRepo) {
    return (
      <div className="tab-content registered-repos">
        <RepositoryDetail
          repository={selectedRepo}
          onBack={() => setSelectedRepo(null)}
        />
      </div>
    );
  }

  return (
    <div className="tab-content registered-repos">
      <div className="content-header">
        <h2>Registered Repositories</h2>
        <button className="add-button">+ Add Repository</button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="repos-list">
        {repos.length === 0 ? (
          <div className="empty-state">
            <p>No repositories registered yet.</p>
            <p className="empty-state-hint">Click "Add Repository" to get started.</p>
          </div>
        ) : (
          repos.map((repo) => (
            <div
              key={repo.id}
              className="repo-card"
              onClick={() => setSelectedRepo(repo)}
            >
              <div className="repo-info">
                <h3 className="repo-name">{repo.owner}/{repo.name}</h3>
                <p className="repo-description">
                  {repo.description || "No description available"}
                </p>
              </div>
              <div className="repo-version">
                <span className="version-label">Latest:</span>
                <span className="version-value">{repo.latestVersion}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


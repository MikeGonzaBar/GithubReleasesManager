import { useState, useEffect } from "react";
import "./RegisteredRepos.css";
import RepositoryDetail from "./RepositoryDetail";
import AddRepoDialog from "./AddRepoDialog";
import { loadRegisteredRepos } from "../../../shared/utils/repos";
import type { RegisteredRepo } from "../../../types";

export default function RegisteredRepos() {
  const [repos, setRepos] = useState<RegisteredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<RegisteredRepo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load repos on mount
  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    try {
      setLoading(true);
      const loadedRepos = await loadRegisteredRepos();
      setRepos(loadedRepos);
    } catch (error) {
      console.error("Failed to load repos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter repos based on search query
  const filteredRepos = repos.filter((repo) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      repo.owner.toLowerCase().includes(searchLower) ||
      repo.name.toLowerCase().includes(searchLower) ||
      (repo.description?.toLowerCase().includes(searchLower) ?? false)
    );
  });

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
        <button className="add-button" onClick={() => setIsDialogOpen(true)}>
          + Add Repository
        </button>
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
        {loading ? (
          <div className="empty-state">
            <p>Loading repositories...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="empty-state">
            <p>
              {searchQuery
                ? "No repositories match your search."
                : "No repositories registered yet."}
            </p>
            {!searchQuery && (
              <p className="empty-state-hint">Click "Add Repository" to get started.</p>
            )}
          </div>
        ) : (
          filteredRepos.map((repo, index) => (
            <div
              key={`${repo.owner}-${repo.name}-${index}`}
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
                <span className="version-value">{repo.latest_version}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <AddRepoDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={loadRepos}
      />
    </div>
  );
}


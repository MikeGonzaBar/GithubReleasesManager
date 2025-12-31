import { useState, useEffect, useMemo, useCallback } from "react";
import "./RegisteredRepos.css";
import RepositoryDetail from "./RepositoryDetail";
import AddRepoDialog from "./AddRepoDialog";
import { loadRegisteredRepos, deleteRegisteredRepo } from "../../../shared/utils/repos";
import { getErrorMessage } from "../../../shared/utils/errorHandler";
import { useToast } from "../../../shared/components/ToastContainer";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import { RepoAvatar } from "../../../shared/components/RepoAvatar";
import { QuickActions } from "../../../shared/components/QuickActions";
import { RepoCardSkeleton } from "../../../shared/components/LoadingSkeleton";
import { ask } from "@tauri-apps/plugin-dialog";
import type { RegisteredRepo } from "../../../types";

export default function RegisteredRepos() {
  const [repos, setRepos] = useState<RegisteredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<RegisteredRepo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast } = useToast();

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const loadRepos = useCallback(async () => {
    try {
      setLoading(true);
      const loadedRepos = await loadRegisteredRepos();
      setRepos(loadedRepos);
    } catch (error) {
      console.error("Failed to load repos:", error);
      const errorMessage = getErrorMessage(error, "Failed to load repositories");
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load repos on mount
  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  // Filter repos based on search query - memoized for performance with debounced search
  const filteredRepos = useMemo(() => {
    const searchLower = debouncedSearchQuery.toLowerCase();
    return repos.filter((repo) => {
      return (
        repo.owner.toLowerCase().includes(searchLower) ||
        repo.name.toLowerCase().includes(searchLower) ||
        (repo.description?.toLowerCase().includes(searchLower) ?? false)
      );
    });
  }, [repos, debouncedSearchQuery]);

  const handleDelete = useCallback(async (repo: RegisteredRepo, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = await ask(
      `Are you sure you want to unregister this repository?\n\n${repo.owner}/${repo.name}\n\nThis will remove it from your registered repositories list.`,
      {
        title: "Unregister Repository",
        kind: "warning",
        okLabel: "Unregister",
        cancelLabel: "Cancel",
      }
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setDeleting(`${repo.owner}/${repo.name}`);
      await deleteRegisteredRepo(repo.owner, repo.name);
      await loadRepos();
      showToast("Repository unregistered successfully!", "success");
    } catch (error) {
      console.error("Delete failed:", error);
      const errorMessage = getErrorMessage(error, "Failed to unregister repository");
      showToast(errorMessage, "error");
    } finally {
      setDeleting(null);
    }
  }, [loadRepos, showToast]);

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
        <button type="button" className="add-button" onClick={() => setIsDialogOpen(true)}>
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
          <>
            <RepoCardSkeleton />
            <RepoCardSkeleton />
            <RepoCardSkeleton />
          </>
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
          filteredRepos.map((repo) => {
            const formatDate = (dateString?: string) => {
              if (!dateString) return "Never";
              const date = new Date(dateString);
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);

              if (diffMins < 1) return "Just now";
              if (diffMins < 60) return `${diffMins}m ago`;
              if (diffHours < 24) return `${diffHours}h ago`;
              if (diffDays < 7) return `${diffDays}d ago`;
              return date.toLocaleDateString();
            };

            return (
              <div
                key={`${repo.owner}-${repo.name}`}
                className="repo-card"
              >
                <div className="repo-card-main" onClick={() => setSelectedRepo(repo)}>
                  <RepoAvatar
                    owner={repo.owner}
                    repoName={repo.name}
                    avatarUrl={repo.avatar_url}
                    size={36}
                  />
                  <div className="repo-info">
                    <div className="repo-header">
                      <h3 className="repo-name">{repo.owner}/{repo.name}</h3>
                      {repo.release_count !== undefined && repo.release_count > 0 && (
                        <span className="release-count-badge" title={`${repo.release_count} release${repo.release_count !== 1 ? 's' : ''}`}>
                          {repo.release_count}
                        </span>
                      )}
                    </div>
                    <p className="repo-description-compact">
                      {repo.description || "No description available"}
                    </p>
                    <div className="repo-meta-compact">
                      <span className="version-value-compact">{repo.latest_version}</span>
                      {repo.last_checked && (
                        <span className="last-checked-compact">
                          {formatDate(repo.last_checked)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="repo-actions" onClick={(e) => e.stopPropagation()}>
                  <QuickActions
                    repoOwner={repo.owner}
                    repoName={repo.name}
                    version={repo.latest_version !== "No releases" ? repo.latest_version : undefined}
                    onCopy={() => showToast("Copied to clipboard!", "success", 2000)}
                  />
                  <button
                    type="button"
                    className="delete-repo-button"
                    onClick={(e) => handleDelete(repo, e)}
                    disabled={deleting === `${repo.owner}/${repo.name}`}
                    title="Unregister this repository"
                  >
                    {deleting === `${repo.owner}/${repo.name}` ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            );
          })
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


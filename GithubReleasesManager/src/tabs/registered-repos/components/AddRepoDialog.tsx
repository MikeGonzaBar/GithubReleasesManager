import { useState } from "react";
import "./AddRepoDialog.css";
import { parseGitHubUrl, fetchRepoInfo, fetchReleases } from "../../../shared/utils/github";
import { saveRegisteredRepo } from "../../../shared/utils/repos";
import { getErrorMessage } from "../../../shared/utils/errorHandler";
import { useToast } from "../../../shared/components/ToastContainer";
import type { RegisteredRepo } from "../../../types";

interface AddRepoDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddRepoDialog({ isOpen, onClose, onSuccess }: AddRepoDialogProps) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Parse the URL
            const { owner, repo } = await parseGitHubUrl(url.trim());

            // Validate repository exists by fetching repo info
            const repoInfo = await fetchRepoInfo(owner, repo);

            // Fetch releases to get the latest version and count
            const releases = await fetchReleases(owner, repo);
            const nonDraftReleases = releases.filter(r => !r.is_draft);
            const latestVersion = nonDraftReleases.length > 0
                ? nonDraftReleases[0].version
                : "No releases";

            // Create registered repo object
            const registeredRepo: RegisteredRepo = {
                owner: repoInfo.owner,
                name: repoInfo.name,
                description: repoInfo.description,
                latest_version: latestVersion,
                added_date: new Date().toISOString(),
                avatar_url: repoInfo.avatar_url,
                last_checked: new Date().toISOString(),
                release_count: nonDraftReleases.length,
            };

            // Save to storage
            await saveRegisteredRepo(registeredRepo);

            // Reset form and close
            setUrl("");
            setError(null);
            onSuccess();
            onClose();
            showToast("Repository added successfully!", "success");
        } catch (err) {
            const errorMessage = getErrorMessage(err, "Failed to add repository");
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setUrl("");
            setError(null);
            onClose();
        }
    };

    return (
        <div className="dialog-overlay" onClick={handleClose}>
            <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                    <h2>Add Repository</h2>
                    <button type="button" className="dialog-close" onClick={handleClose} disabled={loading}>
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dialog-body">
                        <label htmlFor="repo-url">GitHub Repository URL</label>
                        <input
                            id="repo-url"
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo or owner/repo"
                            disabled={loading}
                            required
                            autoFocus
                        />
                        {error && <div className="dialog-error">{error}</div>}
                    </div>

                    <div className="dialog-footer">
                        <button type="button" onClick={handleClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading || !url.trim()}>
                            {loading ? "Adding..." : "Add Repository"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


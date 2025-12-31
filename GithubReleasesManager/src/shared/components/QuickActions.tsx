import { useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Tooltip } from "./Tooltip";
import "./QuickActions.css";

interface QuickActionsProps {
    repoOwner: string;
    repoName: string;
    version?: string;
    onCopy?: () => void;
}

export function QuickActions({ repoOwner, repoName, version, onCopy }: QuickActionsProps) {
    const handleOpenInBrowser = useCallback(async () => {
        const url = version
            ? `https://github.com/${repoOwner}/${repoName}/releases/tag/${version}`
            : `https://github.com/${repoOwner}/${repoName}`;
        try {
            await openUrl(url);
        } catch (error) {
            console.error("Failed to open URL:", error);
            // Fallback to window.open if opener fails (for development)
            if (typeof window !== 'undefined') {
                window.open(url, '_blank');
            }
        }
    }, [repoOwner, repoName, version]);

    const handleCopyVersion = useCallback(() => {
        if (version) {
            navigator.clipboard.writeText(version).then(() => {
                if (onCopy) {
                    onCopy();
                }
            });
        }
    }, [version, onCopy]);

    const handleCopyRepo = useCallback(() => {
        const repoPath = `${repoOwner}/${repoName}`;
        navigator.clipboard.writeText(repoPath).then(() => {
            if (onCopy) {
                onCopy();
            }
        });
    }, [repoOwner, repoName, onCopy]);

    return (
        <div className="quick-actions">
            {version && (
                <Tooltip content="Copy version to clipboard">
                    <button
                        type="button"
                        className="quick-action-button"
                        onClick={handleCopyVersion}
                        aria-label="Copy version"
                    >
                        📋
                    </button>
                </Tooltip>
            )}
            <Tooltip content="Copy repository path">
                <button
                    type="button"
                    className="quick-action-button"
                    onClick={handleCopyRepo}
                    aria-label="Copy repository"
                >
                    🔗
                </button>
            </Tooltip>
            <Tooltip content="Open in browser">
                <button
                    type="button"
                    className="quick-action-button"
                    onClick={handleOpenInBrowser}
                    aria-label="Open in browser"
                >
                    🌐
                </button>
            </Tooltip>
        </div>
    );
}


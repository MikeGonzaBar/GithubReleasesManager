import "./RepoAvatar.css";

interface RepoAvatarProps {
    owner: string;
    repoName: string;
    avatarUrl?: string;
    size?: number;
    className?: string;
}

export function RepoAvatar({ owner, repoName, avatarUrl, size = 48, className = "" }: RepoAvatarProps) {
    const fallbackInitials = `${owner[0]}${repoName[0]}`.toUpperCase();

    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={`${owner}/${repoName} avatar`}
                className={`repo-avatar ${className}`}
                style={{ width: size, height: size }}
                onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                        const fallback = document.createElement("div");
                        fallback.className = `repo-avatar-fallback ${className}`;
                        fallback.style.width = `${size}px`;
                        fallback.style.height = `${size}px`;
                        fallback.textContent = fallbackInitials;
                        parent.appendChild(fallback);
                    }
                }}
            />
        );
    }

    return (
        <div
            className={`repo-avatar-fallback ${className}`}
            style={{ width: size, height: size }}
        >
            {fallbackInitials}
        </div>
    );
}


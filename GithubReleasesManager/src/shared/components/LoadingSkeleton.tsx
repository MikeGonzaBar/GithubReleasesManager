import "./LoadingSkeleton.css";

interface LoadingSkeletonProps {
    width?: string;
    height?: string;
    className?: string;
}

export function LoadingSkeleton({ width = "100%", height = "1rem", className = "" }: LoadingSkeletonProps) {
    return (
        <div
            className={`loading-skeleton ${className}`}
            style={{ width, height }}
        />
    );
}

export function RepoCardSkeleton() {
    return (
        <div className="repo-card-skeleton">
            <div className="skeleton-avatar" />
            <div className="skeleton-content">
                <LoadingSkeleton width="60%" height="1.2rem" />
                <LoadingSkeleton width="80%" height="0.9rem" className="skeleton-margin" />
                <LoadingSkeleton width="40%" height="0.9rem" />
            </div>
        </div>
    );
}


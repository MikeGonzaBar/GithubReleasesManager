/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i === 0) return `${Math.floor(bytes)} B`;
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}


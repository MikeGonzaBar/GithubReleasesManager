// Utility functions for download file management

/**
 * Sanitize a string to be safe for use in file/folder names
 * Removes invalid characters for Windows, Linux, and macOS
 */
function sanitizeFileName(str: string, fallback = "download"): string {
  const reservedWindowsNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  const sanitized = str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim()
    .replace(/[. ]+$/g, "_");

  if (!sanitized) {
    return fallback;
  }

  if (reservedWindowsNames.test(sanitized)) {
    return `${sanitized}_`;
  }

  return sanitized;
}

/**
 * Generate a suggested folder name for a repository
 * Format: {repo_owner}-{repo_name}
 */
export function getRepoFolderName(owner: string, name: string): string {
  return `${sanitizeFileName(owner, "owner")}-${sanitizeFileName(name, "repo")}`;
}

/**
 * Generate a suggested file path for a download
 * Format: {folder}/{filename}-{version}.{ext}
 * 
 * This creates a folder per repository to prevent file name conflicts
 * between different repositories that might have files with the same name.
 */
export function getSuggestedDownloadPath(
  owner: string,
  name: string,
  fileName: string,
  version?: string
): string {
  const folderName = getRepoFolderName(owner, name);
  const sanitizedFileName = sanitizeFileName(fileName);
  
  // Extract extension
  const lastDot = sanitizedFileName.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < sanitizedFileName.length - 1;
  const ext = hasExtension ? sanitizedFileName.substring(lastDot) : "";
  const baseName = hasExtension
    ? sanitizedFileName.substring(0, lastDot)
    : sanitizedFileName;
  
  // Build filename with version if provided
  let finalFileName = baseName;
  if (version?.trim()) {
    // Remove 'v' prefix from version for cleaner filename
    const cleanVersion = sanitizeFileName(version.replace(/^v/i, ""), "version");
    finalFileName = `${baseName}-${cleanVersion}`;
  }
  
  // Return folder/filename structure
  return `${folderName}/${finalFileName}${ext}`;
}

/**
 * Ensure the file path includes the folder structure for the repository
 * If the user selected a different location, create the folder structure there
 */
export function ensureFolderStructure(
  selectedPath: string,
  owner: string,
  name: string
): string {
  const folderName = getRepoFolderName(owner, name);
  
  // Normalize path separators (handle both Windows and Unix)
  const normalizedPath = selectedPath.replace(/\\/g, '/');
  
  // Extract directory and filename from selected path
  const lastSlash = normalizedPath.lastIndexOf('/');
  const dir = lastSlash !== -1 ? normalizedPath.substring(0, lastSlash) : '';
  const selectedFileName = sanitizeFileName(
    lastSlash !== -1 ? normalizedPath.substring(lastSlash + 1) : normalizedPath
  );
  const originalLastSlash = Math.max(selectedPath.lastIndexOf('/'), selectedPath.lastIndexOf('\\'));
  const originalDir = originalLastSlash !== -1 ? selectedPath.substring(0, originalLastSlash) : '';
  
  // Check if folder structure already exists in the path
  if (dir.endsWith(folderName) || dir.includes(`/${folderName}/`) || dir === folderName) {
    // Folder structure already in path, use as is
    return selectedPath;
  }
  
  // Create folder structure in the selected directory
  // Use the original path separator style
  const separator = selectedPath.includes('\\') ? '\\' : '/';
  const repoFolder = originalDir ? `${originalDir}${separator}${folderName}` : folderName;
  const finalPath = `${repoFolder}${separator}${selectedFileName}`;
  
  return finalPath;
}


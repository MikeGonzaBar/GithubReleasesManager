// Utility for registered repositories
import { invoke } from '@tauri-apps/api/core';
import { VERSION_PRE_RELEASE_ORDER } from '../constants';
import type { RegisteredRepo } from '../../types';

// Load registered repositories from storage
export async function loadRegisteredRepos(): Promise<RegisteredRepo[]> {
  try {
    return await invoke<RegisteredRepo[]>('load_registered_repos');
  } catch (error) {
    console.error('Failed to load registered repos:', error);
    return [];
  }
}

// Save a registered repository to storage
export async function saveRegisteredRepo(repo: RegisteredRepo): Promise<void> {
  try {
    await invoke('save_registered_repo', { repo });
  } catch (error) {
    console.error('Failed to save registered repo:', error);
    throw error;
  }
}

// Delete a registered repository
export async function deleteRegisteredRepo(owner: string, name: string): Promise<void> {
  try {
    await invoke('delete_registered_repo', { owner, name });
  } catch (error) {
    console.error('Failed to delete registered repo:', error);
    throw error;
  }
}

// Find a registered repo by owner and name
export async function findRegisteredRepo(owner: string, name: string): Promise<RegisteredRepo | undefined> {
  const repos = await loadRegisteredRepos();
  return repos.find((repo) => repo.owner === owner && repo.name === name);
}

// Update last checked timestamp for a repository
export async function updateRepoLastChecked(owner: string, name: string): Promise<void> {
  try {
    await invoke('update_repo_last_checked', { owner, name });
  } catch (error) {
    console.error('Failed to update last checked:', error);
    // Don't throw - this is a non-critical operation
  }
}

// Parse version string into components
interface VersionParts {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  preReleaseNumber?: number;
}

function parseVersion(version: string): VersionParts {
  // Remove 'v' prefix if present
  let clean = version.replace(/^v/i, "").trim();

  // Split version and pre-release parts
  const preReleaseMatch = clean.match(/^(.+?)[-+](.+)$/);
  const versionPart = preReleaseMatch ? preReleaseMatch[1] : clean;
  const preReleasePart = preReleaseMatch ? preReleaseMatch[2] : null;

  // Split version into major.minor.patch
  const parts = versionPart.split(".").map(p => p.trim());

  const major = parseInt(parts[0] || "0", 10) || 0;
  const minor = parseInt(parts[1] || "0", 10) || 0;
  const patch = parseInt(parts[2] || "0", 10) || 0;

  let preRelease: string | undefined;
  let preReleaseNumber: number | undefined;

  if (preReleasePart) {
    // Try to extract number from pre-release (e.g., "beta1" -> "beta", 1)
    const preReleaseNumMatch = preReleasePart.match(/^([a-zA-Z]+)(\d+)$/i);
    if (preReleaseNumMatch) {
      preRelease = preReleaseNumMatch[1].toLowerCase();
      preReleaseNumber = parseInt(preReleaseNumMatch[2], 10);
    } else {
      preRelease = preReleasePart.toLowerCase();
    }
  }

  return { major, minor, patch, preRelease, preReleaseNumber };
}

// Compare version strings following SemVer rules
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
export function compareVersions(v1: string, v2: string): number {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);

  // Compare major version
  if (ver1.major > ver2.major) return 1;
  if (ver1.major < ver2.major) return -1;

  // Compare minor version
  if (ver1.minor > ver2.minor) return 1;
  if (ver1.minor < ver2.minor) return -1;

  // Compare patch version
  if (ver1.patch > ver2.patch) return 1;
  if (ver1.patch < ver2.patch) return -1;

  // If versions are equal, compare pre-release tags
  // A version without a pre-release is greater than one with a pre-release
  if (!ver1.preRelease && ver2.preRelease) return 1;
  if (ver1.preRelease && !ver2.preRelease) return -1;

  // Both have pre-release tags
  if (ver1.preRelease && ver2.preRelease) {
    // Compare pre-release identifiers
    const pre1 = ver1.preRelease;
    const pre2 = ver2.preRelease;

    // Common pre-release order: alpha < beta < rc < (none)
    const preReleaseOrder: { [key: string]: number } = VERSION_PRE_RELEASE_ORDER;

    const order1 = preReleaseOrder[pre1] || 0;
    const order2 = preReleaseOrder[pre2] || 0;

    if (order1 !== order2) {
      return order1 > order2 ? 1 : -1;
    }

    // If same type, compare numbers if available
    if (ver1.preReleaseNumber !== undefined && ver2.preReleaseNumber !== undefined) {
      if (ver1.preReleaseNumber > ver2.preReleaseNumber) return 1;
      if (ver1.preReleaseNumber < ver2.preReleaseNumber) return -1;
    }

    // String comparison as fallback
    if (pre1 > pre2) return 1;
    if (pre1 < pre2) return -1;
  }

  return 0;
}

// Check if version v1 is newer than v2
export function isVersionNewer(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}


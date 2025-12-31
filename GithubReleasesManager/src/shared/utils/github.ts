import { invoke } from '@tauri-apps/api/core';
import type { Release, Commit, RepoInfo } from '../../types';

/**
 * Parse a GitHub URL to extract owner and repo
 * Supports formats like:
 * - https://github.com/owner/repo
 * - owner/repo
 */
export async function parseGitHubUrl(url: string): Promise<{ owner: string; repo: string }> {
    try {
        const result = await invoke<[string, string]>('parse_github_url', { url });
        return { owner: result[0], repo: result[1] };
    } catch (error) {
        throw new Error(`Failed to parse GitHub URL: ${error}`);
    }
}

/**
 * Fetch repository info from GitHub API
 */
export async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    try {
        return await invoke<RepoInfo>('fetch_github_repo_info', { owner, repo });
    } catch (error) {
        throw new Error(`Failed to fetch repository info: ${error}`);
    }
}

/**
 * Fetch releases from GitHub API
 */
export async function fetchReleases(owner: string, repo: string): Promise<Release[]> {
    try {
        return await invoke<Release[]>('fetch_github_releases', { owner, repo });
    } catch (error) {
        throw new Error(`Failed to fetch releases: ${error}`);
    }
}

/**
 * Fetch commits for a specific release
 */
export async function fetchReleaseCommits(
    owner: string,
    repo: string,
    tag: string
): Promise<Commit[]> {
    try {
        return await invoke<Commit[]>('fetch_release_commits', { owner, repo, tag });
    } catch (error) {
        throw new Error(`Failed to fetch commits: ${error}`);
    }
}


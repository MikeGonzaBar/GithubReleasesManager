// Utility for registered repositories
import { invoke } from '@tauri-apps/api/core';
export { compareVersions, isVersionNewer } from './version.ts';
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


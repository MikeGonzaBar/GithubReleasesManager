export interface InstalledApp {
  repo_owner: string;
  repo_name: string;
  version: string;
  description: string | null;
  download_path: string;
  installed_date: string;
}

export interface RegisteredRepo {
  owner: string;
  name: string;
  description: string | null;
  latest_version: string;
  added_date: string;
  avatar_url?: string;
  last_checked?: string;
  release_count?: number;
}

export interface Release {
  id: number;
  version: string;
  name: string;
  release_date: string;
  is_prerelease: boolean;
  is_draft: boolean;
  description: string | null;
  assets: ReleaseAsset[];
}

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  size_formatted: string;
  url: string;
  content_type: string | null;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface RepoInfo {
  name: string;
  owner: string;
  description: string | null;
  avatar_url?: string;
}

export interface DownloadFile {
  name: string;
  size: string;
  size_formatted: string;
  type: string;
  url: string;
  content_type: string | null;
}


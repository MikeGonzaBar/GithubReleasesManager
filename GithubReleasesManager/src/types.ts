export interface InstalledApp {
  repo_owner: string;
  repo_name: string;
  version: string;
  description: string | null;
  download_path: string;
  installed_date: string;
}

export interface DownloadFile {
  name: string;
  size: string;
  type: string;
  url?: string; // URL will be added when we integrate with real GitHub API
}


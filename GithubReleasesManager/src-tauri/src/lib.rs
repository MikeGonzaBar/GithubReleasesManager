use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledApp {
    pub repo_owner: String,
    pub repo_name: String,
    pub version: String,
    pub description: Option<String>,
    pub download_path: String,
    pub installed_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstalledAppsData {
    apps: Vec<InstalledApp>,
}

// Get the path to the data file
fn get_data_file_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    app_data_dir.join("installed_apps.json")
}

// Load installed apps from file
#[tauri::command]
fn load_installed_apps(app: tauri::AppHandle) -> Result<Vec<InstalledApp>, String> {
    let file_path = get_data_file_path(&app);

    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let data: InstalledAppsData =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(data.apps)
}

// Save installed apps to file
#[tauri::command]
fn save_installed_app(app: tauri::AppHandle, installed_app: InstalledApp) -> Result<(), String> {
    let file_path = get_data_file_path(&app);

    // Load existing apps
    let mut apps = if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        serde_json::from_str::<InstalledAppsData>(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?
            .apps
    } else {
        Vec::new()
    };

    // Check if app already exists (same repo and version)
    let exists = apps.iter().any(|app| {
        app.repo_owner == installed_app.repo_owner
            && app.repo_name == installed_app.repo_name
            && app.version == installed_app.version
    });

    if !exists {
        apps.push(installed_app);
    }

    // Save back to file
    let data = InstalledAppsData { apps };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// Download a file from URL with progress tracking
#[tauri::command]
async fn download_file(
    app: tauri::AppHandle,
    url: String,
    file_path: String,
    file_name: String,
) -> Result<String, String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let client = reqwest::Client::new();
    let mut response = client
        .get(&url)
        .header("User-Agent", "GithubReleasesManager/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut file =
        std::fs::File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut chunk_count = 0u64;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Failed to read chunk: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;
        downloaded += chunk.len() as u64;
        chunk_count += 1;

        // Emit progress every 10 chunks or if we've downloaded a significant amount
        if chunk_count % 10 == 0 || downloaded == total_size {
            let progress = if total_size > 0 {
                (downloaded as f64 / total_size as f64 * 100.0) as u8
            } else {
                0
            };

            app.emit(
                "download-progress",
                serde_json::json!({
                    "file_name": file_name,
                    "downloaded": downloaded,
                    "total": total_size,
                    "progress": progress
                }),
            )
            .ok();
        }
    }

    Ok(file_path)
}

// Delete a file
#[tauri::command]
fn delete_file(file_path: String) -> Result<(), String> {
    std::fs::remove_file(&file_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}

// Delete a file and its parent folder if empty
#[tauri::command]
fn delete_file_and_cleanup_folder(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);

    // Delete the file
    if path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    // Check if parent directory exists and is empty
    if let Some(parent_dir) = path.parent() {
        if parent_dir.exists() {
            // Check if directory is empty (only count files, ignore hidden/system files)
            let mut has_files = false;
            if let Ok(entries) = std::fs::read_dir(parent_dir) {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let entry_path = entry.path();
                        // Only count regular files (not directories or hidden files)
                        if entry_path.is_file() {
                            if let Some(name) = entry_path.file_name() {
                                let name_str = name.to_string_lossy();
                                // Don't count hidden files or system files
                                if !name_str.starts_with('.')
                                    && name_str != "Thumbs.db"
                                    && name_str != "Desktop.ini"
                                {
                                    has_files = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Delete folder if it's empty
            if !has_files {
                std::fs::remove_dir(parent_dir)
                    .map_err(|e| format!("Failed to delete empty folder: {}", e))?;
            }
        }
    }

    Ok(())
}

// Delete an installed app entry
#[tauri::command]
fn delete_installed_app(
    app: tauri::AppHandle,
    repo_owner: String,
    repo_name: String,
    version: String,
) -> Result<(), String> {
    let file_path = get_data_file_path(&app);

    // Load existing apps
    let mut apps = if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        serde_json::from_str::<InstalledAppsData>(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?
            .apps
    } else {
        Vec::new()
    };

    // Find the app to get its file path before removing
    let app_to_delete = apps.iter().find(|app| {
        app.repo_owner == repo_owner && app.repo_name == repo_name && app.version == version
    });

    let file_path_to_delete = app_to_delete.map(|app| app.download_path.clone());

    // Remove the app entry
    apps.retain(|app| {
        !(app.repo_owner == repo_owner && app.repo_name == repo_name && app.version == version)
    });

    // Save updated apps list
    let data = InstalledAppsData { apps };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    // Delete the file and cleanup folder if empty
    if let Some(path) = file_path_to_delete {
        delete_file_and_cleanup_folder(path)?;
    }

    Ok(())
}

// Update an installed app (replace old version with new)
#[tauri::command]
fn update_installed_app(
    app: tauri::AppHandle,
    repo_owner: String,
    repo_name: String,
    old_version: String,
    new_installed_app: InstalledApp,
) -> Result<(), String> {
    let file_path = get_data_file_path(&app);

    // Load existing apps
    let mut apps = if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        serde_json::from_str::<InstalledAppsData>(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?
            .apps
    } else {
        Vec::new()
    };

    // Remove old version entry
    apps.retain(|app| {
        !(app.repo_owner == repo_owner && app.repo_name == repo_name && app.version == old_version)
    });

    // Add new version
    apps.push(new_installed_app);

    // Save back to file
    let data = InstalledAppsData { apps };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// ============================================================================
// GitHub API Structures and Functions
// ============================================================================

// GitHub API response structures
#[derive(Debug, Serialize, Deserialize)]
struct GitHubRelease {
    id: u64,
    tag_name: String,
    name: String,
    published_at: String,
    prerelease: bool,
    draft: bool,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubAsset {
    id: u64,
    name: String,
    size: u64,
    browser_download_url: String,
    content_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubCommit {
    sha: String,
    commit: CommitInfo,
    author: Option<AuthorInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CommitInfo {
    message: String,
    author: CommitAuthor,
}

#[derive(Debug, Serialize, Deserialize)]
struct CommitAuthor {
    name: String,
    date: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AuthorInfo {
    login: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubRepoInfo {
    name: String,
    full_name: String,
    description: Option<String>,
    owner: RepoOwner,
}

#[derive(Debug, Serialize, Deserialize)]
struct RepoOwner {
    login: String,
}

// Frontend-friendly structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Release {
    pub id: u64,
    pub version: String,
    pub name: String,
    pub release_date: String,
    pub is_prerelease: bool,
    pub is_draft: bool,
    pub description: Option<String>,
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseAsset {
    pub id: u64,
    pub name: String,
    pub size: u64,
    pub size_formatted: String,
    pub url: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Commit {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoInfo {
    pub name: String,
    pub owner: String,
    pub description: Option<String>,
}

// Helper function to format file sizes
fn format_size(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

// Parse GitHub URL to extract owner and repo
#[tauri::command]
fn parse_github_url(url: String) -> Result<(String, String), String> {
    // Remove trailing slash
    let url = url.trim_end_matches('/');

    // Match various GitHub URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo/
    // git@github.com:owner/repo.git
    // owner/repo

    if let Ok(re) = Regex::new(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$") {
        if let Some(caps) = re.captures(&url) {
            if let (Some(owner), Some(repo)) = (caps.get(1), caps.get(2)) {
                return Ok((owner.as_str().to_string(), repo.as_str().to_string()));
            }
        }
    }

    // Try simple owner/repo format
    if let Ok(re) = Regex::new(r"^([^/]+)/([^/]+)$") {
        if let Some(caps) = re.captures(&url) {
            if let (Some(owner), Some(repo)) = (caps.get(1), caps.get(2)) {
                return Ok((owner.as_str().to_string(), repo.as_str().to_string()));
            }
        }
    }

    Err(
        "Invalid GitHub URL format. Expected: https://github.com/owner/repo or owner/repo"
            .to_string(),
    )
}

// Fetch repository info from GitHub API
#[tauri::command]
async fn fetch_github_repo_info(owner: String, repo: String) -> Result<RepoInfo, String> {
    let url = format!("https://api.github.com/repos/{}/{}", owner, repo);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "GithubReleasesManager/1.0")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch repo info: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "GitHub API error ({}): {}",
            status,
            if error_text.is_empty() {
                "Repository not found or access denied".to_string()
            } else {
                error_text
            }
        ));
    }

    let github_repo: GitHubRepoInfo = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(RepoInfo {
        name: github_repo.name,
        owner: github_repo.owner.login,
        description: github_repo.description,
    })
}

// Fetch releases from GitHub API
#[tauri::command]
async fn fetch_github_releases(owner: String, repo: String) -> Result<Vec<Release>, String> {
    let url = format!("https://api.github.com/repos/{}/{}/releases", owner, repo);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "GithubReleasesManager/1.0")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "GitHub API error ({}): {}",
            status,
            if error_text.is_empty() {
                "Failed to fetch releases".to_string()
            } else {
                error_text
            }
        ));
    }

    let github_releases: Vec<GitHubRelease> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let releases: Vec<Release> = github_releases
        .into_iter()
        .map(|gr| {
            Release {
                id: gr.id,
                version: gr.tag_name,
                name: gr.name,
                release_date: gr.published_at.chars().take(10).collect(), // Extract YYYY-MM-DD
                is_prerelease: gr.prerelease,
                is_draft: gr.draft,
                description: gr.body,
                assets: gr
                    .assets
                    .into_iter()
                    .map(|ga| ReleaseAsset {
                        id: ga.id,
                        name: ga.name,
                        size: ga.size,
                        size_formatted: format_size(ga.size),
                        url: ga.browser_download_url,
                        content_type: ga.content_type,
                    })
                    .collect(),
            }
        })
        .collect();

    Ok(releases)
}

// Fetch commits for a specific release
#[tauri::command]
async fn fetch_release_commits(
    owner: String,
    repo: String,
    tag: String,
) -> Result<Vec<Commit>, String> {
    // First, get the release to find the target commit
    let release_url = format!(
        "https://api.github.com/repos/{}/{}/releases/tags/{}",
        owner, repo, tag
    );

    let client = reqwest::Client::new();
    let release_response = client
        .get(&release_url)
        .header("User-Agent", "GithubReleasesManager/1.0")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release: {}", e))?;

    if !release_response.status().is_success() {
        return Err(format!(
            "Failed to fetch release: {}",
            release_response.status()
        ));
    }

    #[derive(Deserialize)]
    struct ReleaseInfo {
        target_commitish: String,
    }

    let release_info: ReleaseInfo = release_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release: {}", e))?;

    // Get commits for the release
    // For simplicity, we'll get the last 30 commits
    let commits_url = format!(
        "https://api.github.com/repos/{}/{}/commits?sha={}&per_page=30",
        owner, repo, release_info.target_commitish
    );

    let commits_response = client
        .get(&commits_url)
        .header("User-Agent", "GithubReleasesManager/1.0")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch commits: {}", e))?;

    if !commits_response.status().is_success() {
        return Err(format!(
            "Failed to fetch commits: {}",
            commits_response.status()
        ));
    }

    let github_commits: Vec<GitHubCommit> = commits_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse commits: {}", e))?;

    let commits: Vec<Commit> = github_commits
        .into_iter()
        .map(|gc| {
            let message = gc.commit.message.lines().next().unwrap_or("").to_string();
            Commit {
                sha: gc.sha.chars().take(7).collect(), // Short SHA
                message,
                author: gc
                    .author
                    .map(|a| a.login)
                    .unwrap_or_else(|| gc.commit.author.name),
                date: gc.commit.author.date.chars().take(10).collect(),
            }
        })
        .collect();

    Ok(commits)
}

// ============================================================================
// Registered Repository Storage
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegisteredRepo {
    pub owner: String,
    pub name: String,
    pub description: Option<String>,
    pub latest_version: String,
    pub added_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RegisteredReposData {
    repos: Vec<RegisteredRepo>,
}

// Get the path to the registered repos file
fn get_registered_repos_file_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    app_data_dir.join("registered_repos.json")
}

// Load registered repositories from file
#[tauri::command]
fn load_registered_repos(app: tauri::AppHandle) -> Result<Vec<RegisteredRepo>, String> {
    let file_path = get_registered_repos_file_path(&app);

    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let data: RegisteredReposData =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(data.repos)
}

// Save a registered repository to file
#[tauri::command]
fn save_registered_repo(app: tauri::AppHandle, repo: RegisteredRepo) -> Result<(), String> {
    let file_path = get_registered_repos_file_path(&app);

    // Load existing repos
    let mut repos = if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        serde_json::from_str::<RegisteredReposData>(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?
            .repos
    } else {
        Vec::new()
    };

    // Check if repo already exists (same owner and name)
    let exists = repos
        .iter()
        .any(|r| r.owner == repo.owner && r.name == repo.name);

    if exists {
        // Update existing repo
        repos.retain(|r| !(r.owner == repo.owner && r.name == repo.name));
    }

    repos.push(repo);

    // Save back to file
    let data = RegisteredReposData { repos };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// Delete a registered repository
#[tauri::command]
fn delete_registered_repo(
    app: tauri::AppHandle,
    owner: String,
    name: String,
) -> Result<(), String> {
    let file_path = get_registered_repos_file_path(&app);

    // Load existing repos
    let mut repos = if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        serde_json::from_str::<RegisteredReposData>(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?
            .repos
    } else {
        Vec::new()
    };

    // Remove the repo
    repos.retain(|r| !(r.owner == owner && r.name == name));

    // Save updated repos list
    let data = RegisteredReposData { repos };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            load_installed_apps,
            save_installed_app,
            download_file,
            delete_file,
            delete_file_and_cleanup_folder,
            delete_installed_app,
            update_installed_app,
            parse_github_url,
            fetch_github_repo_info,
            fetch_github_releases,
            fetch_release_commits,
            load_registered_repos,
            save_registered_repo,
            delete_registered_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

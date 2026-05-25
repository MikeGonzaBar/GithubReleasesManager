use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
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

// Create a local metadata file for update flows that do not have a release asset URL.
#[tauri::command]
fn create_download_file(
    file_path: String,
    repo_owner: String,
    repo_name: String,
    version: String,
    file_name: String,
) -> Result<String, String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let content = format!(
        "GitHub Releases Manager Download\n\nRepository: {}/{}\nVersion: {}\nFile: {}\nCreated: {}\n",
        repo_owner,
        repo_name,
        version,
        file_name,
        chrono::Utc::now().to_rfc3339()
    );

    std::fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path)
}

// Delete a file
#[tauri::command]
fn delete_file(file_path: String) -> Result<(), String> {
    std::fs::remove_file(&file_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}

fn is_ignorable_cleanup_file(name: &str) -> bool {
    name.starts_with('.')
        || name.eq_ignore_ascii_case("Thumbs.db")
        || name.eq_ignore_ascii_case("Desktop.ini")
}

fn cleanup_parent_folder_if_no_user_files(parent_dir: &Path) -> Result<(), String> {
    if !parent_dir.exists() || !parent_dir.is_dir() {
        return Ok(());
    }

    let mut ignored_files = Vec::new();
    let entries =
        std::fs::read_dir(parent_dir).map_err(|e| format!("Failed to read folder: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read folder entry: {}", e))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read folder entry metadata: {}", e))?;

        if !file_type.is_file() {
            return Ok(());
        }

        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if is_ignorable_cleanup_file(&file_name) {
            ignored_files.push(entry.path());
        } else {
            return Ok(());
        }
    }

    for ignored_file in ignored_files {
        std::fs::remove_file(&ignored_file)
            .map_err(|e| format!("Failed to delete ignored file: {}", e))?;
    }

    std::fs::remove_dir(parent_dir).map_err(|e| format!("Failed to delete empty folder: {}", e))?;

    Ok(())
}

// Delete a file and its parent folder if empty
#[tauri::command]
fn delete_file_and_cleanup_folder(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);

    // Delete the file
    if path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    if let Some(parent_dir) = path.parent() {
        cleanup_parent_folder_if_no_user_files(parent_dir)?;
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
// GitHub API Cache System
// ============================================================================

// Cache entry with timestamp
#[derive(Debug, Serialize, Deserialize, Clone)]
struct CacheEntry<T> {
    data: T,
    cached_at: i64, // Unix timestamp
}

// Cache data structure
#[derive(Debug, Serialize, Deserialize)]
struct ApiCache {
    repo_info: std::collections::HashMap<String, CacheEntry<RepoInfo>>,
    releases: std::collections::HashMap<String, CacheEntry<Vec<Release>>>,
    commits: std::collections::HashMap<String, CacheEntry<Vec<Commit>>>,
}

// Cache TTL in seconds (10 minutes)
const CACHE_TTL_SECONDS: i64 = 600;

// Get cache file path
fn get_cache_file_path(app: &tauri::AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    app_data_dir.join("api_cache.json")
}

// Load cache from file
fn load_cache(app: &tauri::AppHandle) -> ApiCache {
    let file_path = get_cache_file_path(app);

    if !file_path.exists() {
        return ApiCache {
            repo_info: std::collections::HashMap::new(),
            releases: std::collections::HashMap::new(),
            commits: std::collections::HashMap::new(),
        };
    }

    match std::fs::read_to_string(&file_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| ApiCache {
            repo_info: std::collections::HashMap::new(),
            releases: std::collections::HashMap::new(),
            commits: std::collections::HashMap::new(),
        }),
        Err(_) => ApiCache {
            repo_info: std::collections::HashMap::new(),
            releases: std::collections::HashMap::new(),
            commits: std::collections::HashMap::new(),
        },
    }
}

// Save cache to file
fn save_cache(app: &tauri::AppHandle, cache: &ApiCache) -> Result<(), String> {
    let file_path = get_cache_file_path(app);
    let json = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize cache: {}", e))?;
    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write cache: {}", e))?;
    Ok(())
}

// Check if cache entry is still valid
fn is_cache_valid(cached_at: i64) -> bool {
    let now = chrono::Utc::now().timestamp();
    (now - cached_at) < CACHE_TTL_SECONDS
}

// Generate cache key for repo info
fn repo_info_cache_key(owner: &str, repo: &str) -> String {
    format!("{}:{}", owner, repo)
}

// Generate cache key for releases
fn releases_cache_key(owner: &str, repo: &str) -> String {
    format!("releases:{}:{}", owner, repo)
}

// Generate cache key for commits
fn commits_cache_key(owner: &str, repo: &str, tag: &str) -> String {
    format!("commits:{}:{}:{}", owner, repo, tag)
}

fn percent_encode_path_segment(segment: &str) -> String {
    let mut encoded = String::new();

    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }

    encoded
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
    avatar_url: Option<String>,
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
    pub avatar_url: Option<String>,
}

// Helper function to format file sizes
fn format_size(bytes: u64) -> String {
    const UNITS: [&str; 7] = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
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

fn validate_github_owner_repo(owner: &str, repo: &str) -> Result<(String, String), String> {
    let owner_re = Regex::new(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
        .map_err(|e| format!("Failed to build owner regex: {}", e))?;
    let repo_re = Regex::new(r"^[A-Za-z0-9._-]+$")
        .map_err(|e| format!("Failed to build repo regex: {}", e))?;

    if !owner_re.is_match(owner) || !repo_re.is_match(repo) {
        return Err(
            "Invalid GitHub URL format. Expected: https://github.com/owner/repo or owner/repo"
                .to_string(),
        );
    }

    Ok((owner.to_string(), repo.to_string()))
}

fn parse_github_owner_repo(input: &str) -> Result<(String, String), String> {
    let value = input.trim();
    let value = value
        .split(['?', '#'])
        .next()
        .unwrap_or(value)
        .trim_end_matches('/');

    if value.is_empty() {
        return Err(
            "Invalid GitHub URL format. Expected: https://github.com/owner/repo or owner/repo"
                .to_string(),
        );
    }

    let github_url_re =
        Regex::new(r"^(?:https?://)?(?:www\.)?github\.com/([^/\s]+)/([^/\s]+?)(?:\.git)?(?:/(.*))?$")
            .map_err(|e| format!("Failed to build URL regex: {}", e))?;
    if let Some(caps) = github_url_re.captures(value) {
        let owner = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
        let repo = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
        if let Some(path) = caps.get(3).map(|m| m.as_str()) {
            let allowed_release_path = path == "releases" || path.starts_with("releases/");
            if !allowed_release_path {
                return Err(
                    "GitHub releases are tracked at the repository level. Use a repository URL like https://github.com/owner/repo, not a branch, file, or folder URL."
                        .to_string(),
                );
            }
        }

        return validate_github_owner_repo(owner, repo);
    }

    let patterns = [
        r"^ssh://git@github\.com/([^/\s]+)/([^/\s]+?)(?:\.git)?/?$",
        r"^git@github\.com:([^/\s]+)/([^/\s]+?)(?:\.git)?/?$",
        r"^([^/\s]+)/([^/\s]+?)(?:\.git)?$",
    ];

    for pattern in patterns {
        let re = Regex::new(pattern).map_err(|e| format!("Failed to build URL regex: {}", e))?;
        if let Some(caps) = re.captures(value) {
            if let (Some(owner), Some(repo)) = (caps.get(1), caps.get(2)) {
                return validate_github_owner_repo(owner.as_str(), repo.as_str());
            }
        }
    }

    Err(
        "Invalid GitHub URL format. Expected: https://github.com/owner/repo or owner/repo"
            .to_string(),
    )
}

// Parse GitHub URL to extract owner and repo
#[tauri::command]
fn parse_github_url(url: String) -> Result<(String, String), String> {
    parse_github_owner_repo(&url)
}

// Fetch repository info from GitHub API
#[tauri::command]
async fn fetch_github_repo_info(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
) -> Result<RepoInfo, String> {
    let cache_key = repo_info_cache_key(&owner, &repo);

    // Check cache first
    let mut cache = load_cache(&app);
    if let Some(entry) = cache.repo_info.get(&cache_key) {
        if is_cache_valid(entry.cached_at) {
            return Ok(entry.data.clone());
        }
    }

    // Cache miss or expired, fetch from API
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

    let repo_info = RepoInfo {
        name: github_repo.name,
        owner: github_repo.owner.login,
        description: github_repo.description,
        avatar_url: github_repo.owner.avatar_url,
    };

    // Store in cache
    cache.repo_info.insert(
        cache_key,
        CacheEntry {
            data: repo_info.clone(),
            cached_at: chrono::Utc::now().timestamp(),
        },
    );
    save_cache(&app, &cache).ok();

    Ok(repo_info)
}

// Fetch releases from GitHub API
#[tauri::command]
async fn fetch_github_releases(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
) -> Result<Vec<Release>, String> {
    let cache_key = releases_cache_key(&owner, &repo);

    // Check cache first
    let mut cache = load_cache(&app);
    if let Some(entry) = cache.releases.get(&cache_key) {
        if is_cache_valid(entry.cached_at) {
            return Ok(entry.data.clone());
        }
    }

    // Cache miss or expired, fetch from API
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

    // Store in cache
    cache.releases.insert(
        cache_key,
        CacheEntry {
            data: releases.clone(),
            cached_at: chrono::Utc::now().timestamp(),
        },
    );
    save_cache(&app, &cache).ok();

    Ok(releases)
}

// Fetch commits for a specific release
#[tauri::command]
async fn fetch_release_commits(
    app: tauri::AppHandle,
    owner: String,
    repo: String,
    tag: String,
) -> Result<Vec<Commit>, String> {
    let cache_key = commits_cache_key(&owner, &repo, &tag);

    // Check cache first
    let mut cache = load_cache(&app);
    if let Some(entry) = cache.commits.get(&cache_key) {
        if is_cache_valid(entry.cached_at) {
            return Ok(entry.data.clone());
        }
    }

    // Cache miss or expired, fetch from API
    // First, get the release to find the target commit
    let encoded_tag = percent_encode_path_segment(&tag);
    let release_url = format!(
        "https://api.github.com/repos/{}/{}/releases/tags/{}",
        owner, repo, encoded_tag
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
    let mut commits_url = reqwest::Url::parse(&format!(
        "https://api.github.com/repos/{}/{}/commits",
        owner, repo
    ))
    .map_err(|e| format!("Failed to build commits URL: {}", e))?;
    commits_url
        .query_pairs_mut()
        .append_pair("sha", &release_info.target_commitish)
        .append_pair("per_page", "30");

    let commits_response = client
        .get(commits_url)
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

    // Store in cache
    cache.commits.insert(
        cache_key,
        CacheEntry {
            data: commits.clone(),
            cached_at: chrono::Utc::now().timestamp(),
        },
    );
    save_cache(&app, &cache).ok();

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_checked: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_count: Option<u32>,
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

// Update last checked timestamp for a repository
#[tauri::command]
fn update_repo_last_checked(
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
        return Ok(()); // No repos to update
    };

    // Update the repo's last_checked timestamp
    if let Some(repo) = repos
        .iter_mut()
        .find(|r| r.owner == owner && r.name == name)
    {
        repo.last_checked = Some(chrono::Utc::now().to_rfc3339());
    }

    // Save updated repos list
    let data = RegisteredReposData { repos };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(test_name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "githubreleasesmanager-{}-{}-{}",
            test_name,
            std::process::id(),
            timestamp
        ));
        fs::create_dir_all(&path).expect("failed to create temp test dir");
        path
    }

    #[test]
    fn format_size_handles_unit_boundaries() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(1), "1 B");
        assert_eq!(format_size(1023), "1023 B");
        assert_eq!(format_size(1024), "1.00 KB");
        assert_eq!(format_size(1536), "1.50 KB");
        assert_eq!(format_size(1024_u64.pow(2)), "1.00 MB");
        assert_eq!(format_size(1024_u64.pow(3)), "1.00 GB");
        assert_eq!(format_size(1024_u64.pow(4)), "1.00 TB");
    }

    #[test]
    fn parse_github_url_accepts_common_repository_forms() {
        let cases = [
            ("https://github.com/owner/repo", ("owner", "repo")),
            ("http://github.com/owner/repo/", ("owner", "repo")),
            ("https://www.github.com/owner/repo.git", ("owner", "repo")),
            (
                "https://github.com/owner/repo/releases/tag/v1.0.0?expanded=true",
                ("owner", "repo"),
            ),
            ("git@github.com:owner/repo.git", ("owner", "repo")),
            ("ssh://git@github.com/owner/repo.git", ("owner", "repo")),
            ("owner/repo", ("owner", "repo")),
            ("owner/repo.git", ("owner", "repo")),
            (" Owner-123/repo.name_1 ", ("Owner-123", "repo.name_1")),
        ];

        for (input, expected) in cases {
            assert_eq!(
                parse_github_url(input.to_string()).unwrap(),
                (expected.0.to_string(), expected.1.to_string()),
                "input should parse: {input}"
            );
        }
    }

    #[test]
    fn parse_github_url_rejects_invalid_or_ambiguous_forms() {
        let cases = [
            "",
            "owner",
            "owner/repo/extra",
            "https://github.com/owner",
            "https://notgithub.com/owner/repo",
            "https://github.com/-owner/repo",
            "https://github.com/owner-/repo",
            "https://github.com/owner/re po",
            "https://github.com/owner/",
            "https://github.com/qarmin/czkawka/tree/master/krokiet",
            "https://github.com/owner/repo/blob/main/README.md",
        ];

        for input in cases {
            assert!(
                parse_github_url(input.to_string()).is_err(),
                "input should be rejected: {input}"
            );
        }
    }

    #[test]
    fn cache_validity_respects_ttl_boundary() {
        let now = chrono::Utc::now().timestamp();
        assert!(is_cache_valid(now));
        assert!(is_cache_valid(now - CACHE_TTL_SECONDS + 1));
        assert!(!is_cache_valid(now - CACHE_TTL_SECONDS));
        assert!(!is_cache_valid(now - CACHE_TTL_SECONDS - 1));
    }

    #[test]
    fn cache_keys_include_expected_namespace_parts() {
        assert_eq!(repo_info_cache_key("owner", "repo"), "owner:repo");
        assert_eq!(releases_cache_key("owner", "repo"), "releases:owner:repo");
        assert_eq!(
            commits_cache_key("owner", "repo", "v1.0.0"),
            "commits:owner:repo:v1.0.0"
        );
    }

    #[test]
    fn percent_encode_path_segment_encodes_tag_special_characters() {
        assert_eq!(percent_encode_path_segment("v1.0.0"), "v1.0.0");
        assert_eq!(
            percent_encode_path_segment("release/v1.0.0+build 1"),
            "release%2Fv1.0.0%2Bbuild%201"
        );
    }

    #[test]
    fn delete_file_and_cleanup_folder_removes_empty_parent() {
        let root = unique_temp_dir("cleanup-empty-parent");
        let file_path = root.join("app.exe");
        fs::write(&file_path, b"payload").expect("failed to write test file");

        delete_file_and_cleanup_folder(file_path.to_string_lossy().to_string()).unwrap();

        assert!(!file_path.exists());
        assert!(!root.exists());
    }

    #[test]
    fn delete_file_and_cleanup_folder_keeps_parent_with_visible_sibling_file() {
        let root = unique_temp_dir("cleanup-visible-sibling");
        let file_path = root.join("app.exe");
        let sibling_path = root.join("keep.txt");
        fs::write(&file_path, b"payload").expect("failed to write test file");
        fs::write(&sibling_path, b"keep").expect("failed to write sibling file");

        delete_file_and_cleanup_folder(file_path.to_string_lossy().to_string()).unwrap();

        assert!(!file_path.exists());
        assert!(sibling_path.exists());
        assert!(root.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_file_and_cleanup_folder_keeps_parent_with_child_directory() {
        let root = unique_temp_dir("cleanup-child-dir");
        let file_path = root.join("app.exe");
        let child_dir = root.join("nested");
        fs::write(&file_path, b"payload").expect("failed to write test file");
        fs::create_dir_all(&child_dir).expect("failed to create child dir");

        delete_file_and_cleanup_folder(file_path.to_string_lossy().to_string()).unwrap();

        assert!(!file_path.exists());
        assert!(child_dir.exists());
        assert!(root.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_file_and_cleanup_folder_removes_ignored_files_then_parent() {
        let root = unique_temp_dir("cleanup-ignored-files");
        let file_path = root.join("app.exe");
        let dot_file = root.join(".DS_Store");
        let thumbs = root.join("Thumbs.db");
        let desktop = root.join("Desktop.ini");
        fs::write(&file_path, b"payload").expect("failed to write test file");
        fs::write(&dot_file, b"ignored").expect("failed to write dot file");
        fs::write(&thumbs, b"ignored").expect("failed to write thumbs file");
        fs::write(&desktop, b"ignored").expect("failed to write desktop file");

        delete_file_and_cleanup_folder(file_path.to_string_lossy().to_string()).unwrap();

        assert!(!file_path.exists());
        assert!(!root.exists());
    }

    #[test]
    fn delete_file_reports_missing_files() {
        let root = unique_temp_dir("delete-missing-file");
        let missing_path = root.join("missing.exe");

        let err = delete_file(missing_path.to_string_lossy().to_string()).unwrap_err();

        assert!(err.starts_with("Failed to delete file:"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn create_download_file_writes_metadata_and_creates_parent_dirs() {
        let root = unique_temp_dir("create-download-file");
        let file_path = root.join("owner-repo").join("repo-1.2.3.txt");

        let returned_path = create_download_file(
            file_path.to_string_lossy().to_string(),
            "owner".to_string(),
            "repo".to_string(),
            "1.2.3".to_string(),
            "repo-1.2.3.txt".to_string(),
        )
        .unwrap();

        let content = fs::read_to_string(&file_path).expect("metadata file should exist");
        assert_eq!(returned_path, file_path.to_string_lossy());
        assert!(content.contains("Repository: owner/repo"));
        assert!(content.contains("Version: 1.2.3"));
        assert!(content.contains("File: repo-1.2.3.txt"));
        let _ = fs::remove_dir_all(root);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_installed_apps,
            save_installed_app,
            download_file,
            create_download_file,
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
            delete_registered_repo,
            update_repo_last_checked
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

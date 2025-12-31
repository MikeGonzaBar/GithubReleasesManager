use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

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
    let app_data_dir = app.path().app_data_dir().expect("Failed to get app data directory");
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
    
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let data: InstalledAppsData = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
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
    
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

// Create a text file with download information
#[tauri::command]
fn create_download_file(
    file_path: String,
    repo_owner: String,
    repo_name: String,
    version: String,
    file_name: String,
) -> Result<String, String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let content = format!(
        "Repository: {}/{}\nVersion: {}\nFile: {}\n\nDownloaded on: {}",
        repo_owner,
        repo_name,
        version,
        file_name,
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    );
    
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(file_path)
}

// Delete a file
#[tauri::command]
fn delete_file(file_path: String) -> Result<(), String> {
    std::fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}

// Delete a file and its parent folder if empty
#[tauri::command]
fn delete_file_and_cleanup_folder(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    
    // Delete the file
    if path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
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
                                if !name_str.starts_with('.') && name_str != "Thumbs.db" && name_str != "Desktop.ini" {
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
        app.repo_owner == repo_owner
            && app.repo_name == repo_name
            && app.version == version
    });
    
    let file_path_to_delete = app_to_delete.map(|app| app.download_path.clone());
    
    // Remove the app entry
    apps.retain(|app| {
        !(app.repo_owner == repo_owner
            && app.repo_name == repo_name
            && app.version == version)
    });
    
    // Save updated apps list
    let data = InstalledAppsData { apps };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
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
        !(app.repo_owner == repo_owner
            && app.repo_name == repo_name
            && app.version == old_version)
    });
    
    // Add new version
    apps.push(new_installed_app);
    
    // Save back to file
    let data = InstalledAppsData { apps };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
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
            create_download_file,
            delete_file,
            delete_file_and_cleanup_folder,
            delete_installed_app,
            update_installed_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

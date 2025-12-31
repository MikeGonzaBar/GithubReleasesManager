# GithubReleasesManager

A cross-platform desktop application built with Tauri, React, and TypeScript to help users manage their downloaded applications that are only available through GitHub.

## Features

- **Repository Management**: Add repositories to your watchlist via GitHub URL and track their releases
- **Real-time GitHub Integration**: Fetch live data from GitHub API including releases, commits, and assets
- **Version Tracking**: Monitor the latest versions of releases for watched repositories with automatic comparison
- **Installed Apps Tracking**: Keep track of all downloaded applications with their versions and locations
- **Release Details**: View commit history with hashes, authors, and messages for each release
- **File Downloads**: Download release assets directly from GitHub with real-time progress tracking
- **Progress Indicators**: Visual progress bars showing download percentage and transfer speed
- **Smart Version Comparison**: Automatic detection of updates using semantic versioning

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust (Tauri)
- **UI Framework**: React with custom CSS
- **Storage**: JSON file-based storage in app data directory

## Project Structure

```text
GithubReleasesManager/
├── src/                          # Frontend React code
│   ├── shared/                   # Shared code used across multiple tabs
│   │   ├── components/           # Shared React components
│   │   │   ├── TabNavigation.tsx # Tab navigation component
│   │   │   └── TabNavigation.css
│   │   └── utils/                # Shared utility functions
│   │       ├── download.ts       # Download path utilities
│   │       ├── repos.ts          # Repository management utilities
│   │       ├── storage.ts        # Storage operations
│   │       └── github.ts         # GitHub API integration utilities
│   ├── tabs/                     # Tab-specific code
│   │   ├── registered-repos/     # Registered Repositories tab
│   │   │   └── components/
│   │   │       ├── RegisteredRepos.tsx  # Repository list view
│   │   │       ├── RegisteredRepos.css
│   │   │       ├── AddRepoDialog.tsx    # Add repository dialog
│   │   │       ├── AddRepoDialog.css
│   │   │       ├── RepositoryDetail.tsx # Releases list view
│   │   │       ├── RepositoryDetail.css
│   │   │       ├── VersionDetail.tsx    # Version details with commits & downloads
│   │   │       └── VersionDetail.css
│   │   ├── installed-apps/       # Installed Apps tab
│   │   │   └── components/
│   │   │       ├── InstalledApps.tsx
│   │   │       └── InstalledApps.css
│   │   └── about/                # About tab
│   │       └── components/
│   │           ├── About.tsx
│   │           └── About.css
│   ├── types.ts                  # TypeScript type definitions
│   ├── App.tsx                   # Main app component
│   ├── App.css
│   └── main.tsx                  # React entry point
├── src-tauri/                    # Rust backend code
│   ├── src/
│   │   └── lib.rs                # Tauri commands, GitHub API, and storage logic
│   ├── Cargo.toml                # Rust dependencies
│   ├── capabilities/             # Tauri permissions
│   └── icons/                    # Application icons
└── README.md                     # This file
```

## Installation

### Prerequisites

- Node.js (v18 or higher)
- Rust (latest stable version)
- System dependencies for Tauri (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

### Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   cd GithubReleasesManager
   npm install
   ```

3. Run in development mode:

   ```bash
   npm run tauri dev
   ```

4. Build for production:

   ```bash
   npm run tauri build
   ```

## Usage

### Registered Repositories Tab

- View all repositories in your watchlist
- Add new repositories by entering a GitHub URL (supports multiple formats: `https://github.com/owner/repo`, `owner/repo`, etc.)
- Click on a repository to see available versions
- Search repositories by name, owner, or description
- Automatically fetches latest version information from GitHub

### Installed Apps Tab

- View all downloaded applications
- See installed version vs latest version
- Track download locations

### Repository Details

- Click any repository to view its releases (fetched live from GitHub API)
- Releases are sorted by date (newest first)
- Click a release version to see:
  - **Commit Changes**: View commit history with hashes, authors, and messages (fetched from GitHub)
  - **Available Files**: View all release assets with file sizes and download directly from GitHub

### Downloading Files

1. Navigate to a repository → Select a version
2. Expand "Available Files" section
3. Click "Download" on any file
4. Choose save location in the file dialog
5. Watch the real-time progress bar showing download percentage and bytes transferred
6. The actual file is downloaded from GitHub (not a placeholder)
7. The app automatically tracks the download in "Installed Apps"

## Data Storage

### App Data Location

The application stores tracking data in platform-specific app data directories:

- **Windows**: `C:\Users\<Username>\AppData\Roaming\com.githubreleasesmanager.app\`
- **macOS**: `~/Library/Application Support/com.githubreleasesmanager.app/`
- **Linux**: `~/.local/share/com.githubreleasesmanager.app/`

**Files**:

- `installed_apps.json` - Contains all installed app information including:
  - Repository owner and name
  - Version downloaded
  - Description/info
  - Download path (where user saved the file)
  - Installation date
- `registered_repos.json` - Contains all registered repositories including:
  - Repository owner and name
  - Latest version
  - Description
  - Date added
- `api_cache.json` - Contains cached GitHub API responses with timestamps:
  - Repository information cache
  - Releases list cache
  - Commit history cache
  - Each entry includes cached data and timestamp for TTL management

### Downloaded Files

Downloaded files are saved to the location selected by the user via the file save dialog. Files are downloaded directly from GitHub release assets, preserving the original file format and content.

## Development

### Hot Reload

- **Frontend changes** (React/TypeScript): Automatically reloads via Vite HMR
- **Backend changes** (Rust): Requires restart of the dev server

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run tauri dev` - Run Tauri app in development mode
- `npm run tauri build` - Build production app
- `npm run build` - Build frontend only

## GitHub API Integration

The application uses the GitHub REST API v3 to fetch real-time data:

- **Repository Information**: Fetches repository metadata including description
- **Releases**: Retrieves all releases with tags, dates, and descriptions
- **Commits**: Fetches commit history for each release
- **Assets**: Downloads release files directly from GitHub

### Caching System

The app implements an intelligent caching system to reduce API calls and improve performance:

- **Cache Duration**: API responses are cached for 10 minutes (600 seconds)
- **Cache Storage**: Cached data is stored in `api_cache.json` in the app data directory
- **Automatic Cache Management**:
  - Cache entries are automatically checked before making API requests
  - Expired cache entries are automatically refreshed
  - Cache persists across app restarts
- **Cached Endpoints**:
  - Repository information (`/repos/{owner}/{repo}`)
  - Releases list (`/repos/{owner}/{repo}/releases`)
  - Commit history (`/repos/{owner}/{repo}/commits`)

This caching system significantly reduces API calls when navigating between views, helping to stay within rate limits while providing a faster user experience.

### Rate Limits

- **Without authentication**: 60 requests per hour per IP address
- **With caching**: Effectively reduces API calls by ~90% for typical usage patterns

The app works without a GitHub account for public repositories. Authentication is optional and only needed for higher rate limits or private repository access.

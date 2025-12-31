# GithubReleasesManager

A cross-platform desktop application built with Tauri, React, and TypeScript to help users manage their downloaded applications that are only available through GitHub.

## Features

- **Repository Management**: Add repositories to your watchlist and track their releases
- **Version Tracking**: Monitor the latest versions of releases for watched repositories
- **Installed Apps Tracking**: Keep track of all downloaded applications with their versions and locations
- **Release Details**: View commit changes and available download files for each release
- **Download Management**: Download files with automatic tracking of installation details

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust (Tauri)
- **UI Framework**: React with custom CSS
- **Storage**: JSON file-based storage in app data directory

## Project Structure

```
GithubReleasesManager/
├── src/                          # Frontend React code
│   ├── shared/                   # Shared code used across multiple tabs
│   │   ├── components/           # Shared React components
│   │   │   ├── TabNavigation.tsx # Tab navigation component
│   │   │   └── TabNavigation.css
│   │   └── utils/                # Shared utility functions
│   │       ├── download.ts       # Download path utilities
│   │       ├── repos.ts          # Repository management utilities
│   │       └── storage.ts        # Storage operations
│   ├── tabs/                     # Tab-specific code
│   │   ├── registered-repos/     # Registered Repositories tab
│   │   │   └── components/
│   │   │       ├── RegisteredRepos.tsx  # Repository list view
│   │   │       ├── RegisteredRepos.css
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
│   │   └── lib.rs                # Tauri commands and storage logic
│   ├── Cargo.toml                # Rust dependencies
│   └── capabilities/             # Tauri permissions
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
- Click on a repository to see available versions
- Search repositories by name

### Installed Apps Tab
- View all downloaded applications
- See installed version vs latest version
- Track download locations

### Repository Details
- Click any repository to view its releases
- Click a release version to see:
  - **Commit Changes**: View commit history with hashes, authors, and messages
  - **Available Files**: Download files (currently creates text files with download info)

### Downloading Files
1. Navigate to a repository → Select a version
2. Expand "Available Files" section
3. Click "Download" on any file
4. Choose save location in the file dialog
5. The app automatically tracks the download in "Installed Apps"

## Data Storage

### App Data Location

The application stores tracking data in platform-specific app data directories:

- **Windows**: `C:\Users\<Username>\AppData\Roaming\com.githubreleasesmanager.app\`
- **macOS**: `~/Library/Application Support/com.githubreleasesmanager.app/`
- **Linux**: `~/.local/share/com.githubreleasesmanager.app/`

**File**: `installed_apps.json` - Contains all installed app information including:
- Repository owner and name
- Version downloaded
- Description/info
- Download path (where user saved the file)
- Installation date

### Downloaded Files

Downloaded files are saved to the location selected by the user via the file save dialog. Currently, downloads create text files containing:
- Repository information
- Version
- File name
- Download timestamp

## Development

### Hot Reload

- **Frontend changes** (React/TypeScript): Automatically reloads via Vite HMR
- **Backend changes** (Rust): Requires restart of the dev server

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run tauri dev` - Run Tauri app in development mode
- `npm run tauri build` - Build production app
- `npm run build` - Build frontend only

## Current Status

⚠️ **Note**: The application currently uses dummy data for demonstration purposes. Integration with the GitHub API is planned for future development.

## License

[Add your license here]
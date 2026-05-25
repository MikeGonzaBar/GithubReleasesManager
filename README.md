# GithubReleasesManager

GithubReleasesManager is a Tauri 2 desktop app for tracking GitHub-hosted tools that do not have their own updater. It lets you register repositories, inspect releases and assets, download release files, and track installed copies so update checks are visible from one place.

Current app version: `0.1.1`.

## Screenshots

![Registered repositories](GithubReleasesManager/docs/screenshots/registered-repos.png)

![Release assets](GithubReleasesManager/docs/screenshots/release-assets.png)

![Download success](GithubReleasesManager/docs/screenshots/download-success.png)

![Installed update available](GithubReleasesManager/docs/screenshots/installed-update-available.png)

![Update success](GithubReleasesManager/docs/screenshots/update-success.png)

![Self update available](GithubReleasesManager/docs/screenshots/self-update-available.png)

## Features

- Register public GitHub repositories from repo-level URLs such as `https://github.com/owner/repo`, `github.com/owner/repo`, or `owner/repo`.
- Fetch repository metadata, releases, release assets, release notes, and commit history from the GitHub REST API.
- Download selected release assets directly from GitHub and save them into a repository-specific folder.
- Track installed downloads with version, description, local path, and install date.
- Compare installed versions against the latest registered repository version.
- Run an Installed Apps update flow that downloads the latest release asset, asks which asset to use when a release has multiple files, updates the app record, and optionally deletes the previous file.
- Check for new GithubReleasesManager desktop releases at startup, download signed updater artifacts, install them, and relaunch.
- Publish tagged app releases with GitHub Actions, including installers and `latest.json` updater metadata.
- Cache GitHub API responses for 10 minutes to reduce rate-limit pressure.

## Tech Stack

- React 18, TypeScript, and Vite 6
- Tauri 2 and Rust
- JSON file storage in the platform app-data directory
- Headless Chromium GUI smoke tests driven through the Chrome DevTools Protocol

## Project Layout

```text
.
├── .github/workflows/release.yml      # Publishes installers and updater metadata on version tags
├── Cargo.toml                         # Workspace manifest for the Tauri backend
├── Cargo.lock                         # Canonical Rust workspace lockfile
├── README.md
└── GithubReleasesManager/
    ├── package.json
    ├── package-lock.json
    ├── docs/screenshots/
    ├── src/                           # React frontend
    │   ├── shared/
    │   └── tabs/
    ├── src-tauri/                     # Rust/Tauri app
    │   ├── Cargo.toml
    │   ├── Cargo.lock                 # Synced for tools that scan this path directly
    │   └── src/
    └── tests/gui/                     # GUI test harness and Tauri mocks
```

## Prerequisites

- Node.js 18 or newer
- Rust stable
- A Chromium-based browser for GUI tests, or `BROWSER_PATH` pointing to one
- Tauri system dependencies for your OS: [Tauri prerequisites](https://tauri.app/start/prerequisites/)

## Setup

```bash
cd GithubReleasesManager
npm install
```

Run the desktop app in development mode:

```bash
npm run tauri dev
```

Build the production app:

```bash
npm run tauri build
```

## Release Publishing And Self Updates

The repository includes a GitHub Actions release workflow at `.github/workflows/release.yml`. Update `GithubReleasesManager/package.json`, `GithubReleasesManager/src-tauri/Cargo.toml`, and `GithubReleasesManager/src-tauri/tauri.conf.json` to the new version, then push a matching version tag such as `v0.1.1`, or run the workflow manually with that tag, to build Windows, macOS, and Linux bundles, publish a GitHub Release, and upload the `latest.json` updater manifest.

Before the first release, add the Tauri signing private key to the GitHub repository secret named `TAURI_SIGNING_PRIVATE_KEY`. The local key generated for this project is ignored by git under `GithubReleasesManager/.tauri/`. If you regenerate the key with a password, also add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

On startup, the app checks:

```text
https://github.com/MikeGonzaBar/GithubReleasesManager/releases/latest/download/latest.json
```

When a newer signed release exists, the app shows an update banner. Installing the app update does not remove selected repositories or installed-app records because those live in the platform app-data directory, outside the installed application bundle.

## Test And Audit

Run the full local verification set from `GithubReleasesManager/`:

```bash
npm run test
npm run test:gui
npm run build
npm run test:rust
npm audit
```

Run the Rust security audit from the repository root:

```bash
cargo audit --file Cargo.lock
cargo audit --no-fetch --file GithubReleasesManager/src-tauri/Cargo.lock
```

The GUI test covers the asset download path, the Installed Apps update path, and the app self-update banner/download/relaunch path. It can also refresh visual review screenshots:

```bash
node tests/gui/run-gui-tests.mjs --screenshots
```

Screenshots are written to `.codex-visual-review/`; copy the reviewed images into `GithubReleasesManager/docs/screenshots/` when they should be committed to the README.

## Dependency Review

Security review date: 2026-05-25.

- `npm audit` reports 0 vulnerabilities after updating Vite to `6.4.2`, the Tauri JavaScript packages to the current Tauri 2 patch/minor line, and adding the updater/process plugins.
- Vite transitive packages are on patched versions: `rollup@4.60.4`, `picomatch@4.0.4`, and `postcss@8.5.15`.
- `cargo audit --file Cargo.lock` reports 0 vulnerabilities after updating Tauri/Rust transitive dependencies, including `bytes@1.11.1`, `quinn-proto@0.11.14`, `rustls-webpki@0.103.13`, and `time@0.3.47`.
- `cargo audit` still reports informational warnings for transitive GTK3-era Linux crates and some `rand`/`glib` advisories. Those are not vulnerability findings in the current audit mode and are inherited through desktop stack dependencies.
- Vite 8, `@vitejs/plugin-react` 6, and React 19 were reviewed but not adopted because the audit fixes are available without a major frontend migration.

## Usage

### Registered Repositories

- Add a repository with a repo-level GitHub URL or `owner/repo`.
- Branch, file, and folder URLs such as `/tree/main/folder` are rejected because GitHub releases are published at the repository level.
- Search registered repositories by owner, name, or description.
- Open a repository to see releases sorted newest first.
- Open a release to inspect release notes, commits, and downloadable assets.

### Downloads

1. Open a repository release.
2. Expand Available Files.
3. Choose Download for the desired asset.
4. Pick a save location.
5. The app enforces a repository folder such as `owner-repo/` to reduce filename collisions.
6. The downloaded file is saved and tracked in Installed Apps.

### Installed Apps

- View installed version, latest registered version, description, and local path.
- Use Refresh to reload stored app records and repository metadata.
- Use Update when a registered repository has a newer version.
- If the latest release has one asset, the update flow downloads that asset after you choose the save path.
- If the latest release has multiple assets, choose the desired asset first, then choose where to save it.
- After download, the app asks whether to delete the old tracked file and then replaces or appends the installed-app record based on that answer.
- Use the folder button to reveal the tracked file location.
- Use delete to remove the tracked app and its file.

## Data Storage

The app stores JSON data in the Tauri app-data directory:

- Windows: `C:\Users\<Username>\AppData\Roaming\com.githubreleasesmanager.app\`
- macOS: `~/Library/Application Support/com.githubreleasesmanager.app/`
- Linux: `~/.local/share/com.githubreleasesmanager.app/`

Stored files:

- `registered_repos.json`
- `installed_apps.json`
- `api_cache.json`

Downloaded release assets are saved wherever the user chooses in the file-save dialog.

## GitHub API Notes

The app works without authentication for public repositories. Anonymous GitHub API traffic is limited to 60 requests per hour per IP address, so the app caches repository info, release lists, and commit history for 10 minutes.

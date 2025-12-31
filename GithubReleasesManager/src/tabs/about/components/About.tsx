import "./About.css";
import iconPath from "/icon.png";

export default function About() {
  return (
    <div className="tab-content about">
      <div className="about-container">
        <div className="app-icon-container">
          <img src={iconPath} alt="GitHub Releases Manager Icon" className="app-icon" />
        </div>
        <h1 className="app-title">GitHub Releases Manager</h1>
        <p className="app-version">Version 1.0.0</p>

        <div className="about-description">
          <p>
            A powerful desktop application to manage your GitHub releases and track downloaded applications.
            Integrated with the GitHub API for real-time release information, commit history, and direct file downloads.
          </p>
        </div>

        <div className="features-list">
          <h3>Features:</h3>
          <ul>
            <li>🔗 Add repositories via GitHub URL with automatic parsing</li>
            <li>📦 Real-time GitHub API integration for releases and commits</li>
            <li>⬇️ Direct file downloads with progress tracking</li>
            <li>📊 Version comparison and update detection</li>
            <li>💾 Automatic tracking of installed applications</li>
            <li>🔍 Search and filter repositories</li>
            <li>📝 View detailed commit history for each release</li>
          </ul>
        </div>

        <div className="tech-stack">
          <h3>Built With:</h3>
          <div className="tech-items">
            <span className="tech-item">Tauri</span>
            <span className="tech-item">React</span>
            <span className="tech-item">TypeScript</span>
            <span className="tech-item">Rust</span>
            <span className="tech-item">GitHub API</span>
          </div>
        </div>

        <div className="about-footer">
          <p>© 2024 GitHub Releases Manager</p>
          <p className="footer-note">Fetches live data from GitHub API • No account required for public repos</p>
        </div>
      </div>
    </div>
  );
}


import "./About.css";

export default function About() {
  return (
    <div className="tab-content about">
      <div className="about-container">
        <h1 className="app-title">GitHub Releases Manager</h1>
        <p className="app-version">Version 0.1.0</p>
        
        <div className="about-description">
          <p>
            This application helps you manage your downloaded applications that are only available through GitHub.
          </p>
        </div>

        <div className="features-list">
          <h3>Features:</h3>
          <ul>
            <li>Add repositories to your watchlist</li>
            <li>Track installed applications</li>
            <li>Monitor latest release versions</li>
            <li>View changes between installed and current versions</li>
          </ul>
        </div>

        <div className="about-footer">
          <p>Built with Tauri, React, and TypeScript</p>
        </div>
      </div>
    </div>
  );
}


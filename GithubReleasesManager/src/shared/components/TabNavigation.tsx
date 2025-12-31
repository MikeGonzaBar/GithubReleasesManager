import "./TabNavigation.css";

type Tab = "repos" | "installed" | "about";

interface TabNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="tab-navigation">
      <button
        className={`tab-button ${activeTab === "repos" ? "active" : ""}`}
        onClick={() => onTabChange("repos")}
      >
        <span className="tab-icon">📦</span>
        <span className="tab-label">Registered Repos</span>
      </button>
      <button
        className={`tab-button ${activeTab === "installed" ? "active" : ""}`}
        onClick={() => onTabChange("installed")}
      >
        <span className="tab-icon">💾</span>
        <span className="tab-label">Installed Apps</span>
      </button>
      <button
        className={`tab-button ${activeTab === "about" ? "active" : ""}`}
        onClick={() => onTabChange("about")}
      >
        <span className="tab-icon">ℹ️</span>
        <span className="tab-label">About</span>
      </button>
    </nav>
  );
}


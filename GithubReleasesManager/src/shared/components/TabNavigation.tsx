import { useCallback, memo } from "react";
import "./TabNavigation.css";

type Tab = "repos" | "installed" | "about";

interface TabNavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const handleTabChange = useCallback((tab: Tab) => {
    onTabChange(tab);
  }, [onTabChange]);

  const reposIsActive = activeTab === "repos";
  const installedIsActive = activeTab === "installed";
  const aboutIsActive = activeTab === "about";

  return (
    <nav className="tab-navigation" role="tablist">
      <button
        type="button"
        className={`tab-button ${reposIsActive ? "active" : ""}`}
        onClick={() => handleTabChange("repos")}
        role="tab"
        {...(reposIsActive && { "aria-selected": "true" })}
      >
        <span className="tab-icon">📦</span>
        <span className="tab-label">Registered Repos</span>
      </button>
      <button
        type="button"
        className={`tab-button ${installedIsActive ? "active" : ""}`}
        onClick={() => handleTabChange("installed")}
        role="tab"
        {...(installedIsActive && { "aria-selected": "true" })}
      >
        <span className="tab-icon">💾</span>
        <span className="tab-label">Installed Apps</span>
      </button>
      <button
        type="button"
        className={`tab-button ${aboutIsActive ? "active" : ""}`}
        onClick={() => handleTabChange("about")}
        role="tab"
        {...(aboutIsActive && { "aria-selected": "true" })}
      >
        <span className="tab-icon">ℹ️</span>
        <span className="tab-label">About</span>
      </button>
    </nav>
  );
}

export default memo(TabNavigation);


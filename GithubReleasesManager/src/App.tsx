import { useState } from "react";
import "./App.css";
import TabNavigation from "./shared/components/TabNavigation";
import RegisteredRepos from "./tabs/registered-repos/components/RegisteredRepos";
import InstalledApps from "./tabs/installed-apps/components/InstalledApps";
import About from "./tabs/about/components/About";

type Tab = "repos" | "installed" | "about";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("repos");

  return (
    <div className="app-container">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="app-content">
        {activeTab === "repos" && <RegisteredRepos />}
        {activeTab === "installed" && <InstalledApps />}
        {activeTab === "about" && <About />}
      </main>
      </div>
  );
}

export default App;

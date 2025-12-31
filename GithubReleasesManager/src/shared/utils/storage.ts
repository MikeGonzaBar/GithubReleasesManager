import { invoke } from "@tauri-apps/api/core";
import type { InstalledApp } from "../types";

export async function loadInstalledApps(): Promise<InstalledApp[]> {
  try {
    return await invoke<InstalledApp[]>("load_installed_apps");
  } catch (error) {
    console.error("Failed to load installed apps:", error);
    return [];
  }
}

export async function saveInstalledApp(app: InstalledApp): Promise<void> {
  try {
    await invoke("save_installed_app", { installedApp: app });
  } catch (error) {
    console.error("Failed to save installed app:", error);
    throw error;
  }
}


import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

const tauriMock = resolve(__dirname, "tests/gui/tauri-mocks.ts");

export default defineConfig(async ({ command, mode }) => {
  const resolvedBase = await baseConfig({ command, mode });

  return mergeConfig(resolvedBase, {
    resolve: {
      alias: {
        "@tauri-apps/api/core": tauriMock,
        "@tauri-apps/api/event": tauriMock,
        "@tauri-apps/plugin-dialog": tauriMock,
        "@tauri-apps/plugin-opener": tauriMock,
        "@tauri-apps/plugin-process": tauriMock,
        "@tauri-apps/plugin-updater": tauriMock,
      },
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
  });
});

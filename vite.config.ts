import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// Sent to BibleQL with every request (`X-App-Version`) and at registration.
// No API key is compiled in any more: each installation registers its own
// (see docs/installation-keys.md), and Unsplash is reached through BibleQL.
const appVersion: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },

  // Vite options tailored for Tauri development, applied by `tauri dev`/`tauri build`.
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  server: {
    // 2. tauri expects a fixed port, fail if that port is not available
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"]
    }
  }
});

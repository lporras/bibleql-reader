import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// .env holds shared defaults; .env.local (git-ignored) overrides it for a
// machine-local key, same convention Vite itself uses.
loadEnv();
loadEnv({ path: resolve(".env.local"), override: true });

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  define: {
    __BIBLEQL_API_KEY__: JSON.stringify(process.env.BIBLEQL_API_KEY ?? ""),
    // Unsplash's public Client-ID auth is designed to be embedded in
    // client apps (no user login, no secret) — see docs/unsplash.md.
    __UNSPLASH_ACCESS_KEY__: JSON.stringify(process.env.UNSPLASH_ACCESS_KEY ?? "")
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

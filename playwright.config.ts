import { defineConfig, devices } from "@playwright/test";

// Browser E2E against the Vite dev server. These specs used to launch the
// packaged Electron binary via `_electron`, which has no Tauri equivalent
// (tauri-driver doesn't support macOS at all). Nearly everything they
// assert — verse selection, the editor handoff, background picking,
// contentEditable commits, Unsplash mocking via page.route — is plain web
// behaviour that the same bundle exhibits in a browser; the handful of
// real shell calls are stubbed and recorded (see e2e/helpers.ts).
//
// Needs BIBLEQL_API_KEY at dev-server start: it's inlined at build time
// by vite.config.ts, and the editor's passage re-fetch isn't covered by
// the app's no-key sample fallback.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:1420",
    ...devices["Desktop Chrome"],
    permissions: ["clipboard-read", "clipboard-write"]
  },
  // Serves a production build, not `vite dev`. The dev server transforms
  // ~300 modules on demand, and three workers hitting it cold all raced
  // past the 60s test timeout in `beforeEach` while it optimized deps —
  // the first test on every worker failed, then everything after it
  // passed in seconds. A built bundle has no such cliff, and it's also
  // closer to what actually ships. `vite build` takes ~2s.
  webServer: {
    command: "vite build && vite preview --port 1420 --strictPort",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [{ name: "chromium" }]
});

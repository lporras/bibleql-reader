import { defineConfig } from "vitest/config";

// Standalone from electron.vite.config.ts — Vitest doesn't read electron-vite's
// multi-target config shape. Tests cover pure logic only (model serialization,
// text layout math, reference formatting…), never components, so plain Node
// is enough: no jsdom, no SCSS transform.
export default defineConfig({
  // Mirrors vite.config.ts's compile-time constant, which Vitest
  // doesn't otherwise define. No API keys exist any more: BibleQL tokens
  // are per-installation, and specs never hit a live service anyway.
  define: {
    __APP_VERSION__: JSON.stringify("0.0.0-test")
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `yarn test:coverage` (CI uploads the lcov report to Codecov for the
    // README badge). Measured over .ts only: components (.tsx) are covered
    // by the Playwright suite, not by Vitest, and would only drag the
    // number down without saying anything about the logic tests.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      reporter: ["text-summary", "lcov"]
    }
  }
});

import { defineConfig } from "vitest/config";

// Standalone from electron.vite.config.ts — Vitest doesn't read electron-vite's
// multi-target config shape. Tests cover pure logic only (model serialization,
// text layout math, reference formatting…), never components, so plain Node
// is enough: no jsdom, no SCSS transform.
export default defineConfig({
  // Mirrors electron.vite.config.ts's compile-time constants — Vitest
  // doesn't go through electron-vite's build, so these are otherwise
  // undefined globals if a tested file (even transitively) references
  // them. Empty strings only: specs must never hit the real BibleQL or
  // Unsplash APIs (see lib/graphql.ts, providers/UnsplashProvider.ts).
  define: {
    __BIBLEQL_API_KEY__: JSON.stringify(""),
    __UNSPLASH_ACCESS_KEY__: JSON.stringify(""),
    __OLLAMA_URL__: JSON.stringify("http://localhost:11434"),
    __OLLAMA_MODEL__: JSON.stringify("gemma4:e4b")
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

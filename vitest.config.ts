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
    __UNSPLASH_ACCESS_KEY__: JSON.stringify("")
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});

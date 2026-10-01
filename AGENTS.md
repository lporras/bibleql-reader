# Project Gotchas and Conventions

This codebase has several unique conventions and gotchas due to its mixed Tauri/React/Rust architecture. Always check `CLAUDE.md` for general guidance.

## 🛠️ Tooling & Commands
- **Development/Testing:** Use `yarn typecheck` (must respect `noUnusedLocals: true` in all projects).
- **E2E Testing:** `yarn test:e2e` relies on mocked APIs via fixtures (`e2e/fixtures/bibleql.json`); these mocks are critical for running tests without network dependencies.
- **Rust/Tauri Compatibility:** Tauri npm packages and Rust crates must match on major/minor versions (e.g., `tauri-plugin-http` pinning).

## 🧱 Architecture & State
- **Source of Truth:** The URL query parameters (`?from=&to=`) dictate the active location and selection, not component state.
- **Styling:** Styling uses Sass Modules and a token system; avoid using general CSS utility libraries like Tailwind or generic component libraries.
- **API Keys & Secrets:**
    - `BIBLEQL_API_KEY` and `UNSPLASH_ACCESS_KEY` are compiled into the bundle (`vite.config.ts`).
    - **Anthropic key is NEVER bundled;** it must be read from `localStorage` and passed per-call to `lib/ai.ts`.

## ⚠️ Common Mistakes & Gotchas
- **Platform Detection:** The `os` plugin returns `"macos"`, not `"darwin"`. Use `platform/host.ts` wrapper.
- **Shell Access:** All Tauri shell calls must go through one of the defined platform abstraction entry points (`platform/index.ts`, `platform/host.ts`, etc.)—never direct plugin imports at the call site.
- **Networking:** BibleQL and Unsplash use plain `fetch` (CORS allowance `*`). Only `api.anthropic.com` routes through the Tauri HTTP plugin.
- **DOM Interaction:** When using `contentEditable` (e.g., in `features/image-creator`), explicitly clear the element's `textContent` before exiting edit mode to prevent visible text doubling.
- **Offline Mode:** Translation queries must use `isLocalNow()` inside the TanStack `queryFn` to correctly switch between remote/local sources.
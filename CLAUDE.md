# CLAUDE.md

Guidance for agents working in this repository.

## What this is

Tauri 2 + Vite 7 + React 19 + TypeScript 5.9 (strict) desktop Bible reader over the BibleQL
GraphQL API (`https://bibleql.org/graphql`), plus a Verse Image Creator (select verses → style
them over a background → export as PNG/JPEG). `"type": "module"`. Yarn, not npm. The UI runs in
the platform webview; `src-tauri/` is a thin Rust shell. Read the neighbouring file before
inventing a pattern; there is almost always precedent.

Migrated from Electron 44 + electron-vite in September 2026. Anything still describing a main
process, a preload, `window.desktop`/`window.ai`/`window.imageCreator`, or `out/` is stale.

## Commands

```bash
yarn tauri dev          # Rust shell + Vite dev server, HMR
yarn dev                # frontend only, in a browser at :1420 (no shell APIs)
yarn tauri build        # typecheck + vitest, then bundle installers
yarn typecheck          # tsc --noEmit across tsconfig.json, tsconfig.node.json, e2e/tsconfig.json
yarn test               # vitest run — pure-logic unit tests, no network, no shell
yarn test:e2e           # Playwright drives the app in headless Chromium
cargo check --manifest-path src-tauri/Cargo.toml    # the Rust side
```

`yarn test:e2e` wants a real `BIBLEQL_API_KEY` in the environment (`.env.local` locally, a repo
secret in CI) — it builds the app, so the key is inlined at that build. No ESLint/Prettier. Match surrounding style by hand.

## Layout

```
index.html                 Vite entry (at the repo root, per Tauri convention)
public/bible-images/       curated Unsplash backgrounds (full/ + thumb/), served as static files
src/
  components/              Reader/, Sidebar/, StudyPanel/, TitleBar/, + standalone (Spinner, icons…)
  features/
    image-creator/         the Verse Image Creator — model/, components/, providers/, rendering/,
                            lib/, data/, state/, hooks/, assets/ (see its own files for detail)
  platform/                PlatformCapabilities — the shell seam (see docs/platform-abstraction.md)
                            + host.ts (IS_MAC)
  routes/                  route-level composition shells (thin — pull their own state/data)
  queries/                 TanStack Query hooks, one per BibleQL query, key factory in keys.ts
  state/                   AppStateContext (Context + useReducer) + persist.ts (localStorage)
  lib/                     graphql client, ai.ts, externalLinks.ts, refs.ts, speech.ts, format.ts
  data/                    static data: books.ts, strings.ts (i18n), sample.ts, fallbackTranslations.ts
  types/                   shared TS types (bible.ts, app.ts, ai.ts, imageCreator.ts)
  styles/                  _tokens.scss (palette), _theme.scss, _mixins.scss, _fonts.scss, global.scss
src-tauri/
  src/lib.rs               plugin registration (opener, dialog, fs, http, os) — no custom commands
  tauri.conf.json          window geometry, macOS title bar style, bundle config
  capabilities/default.json  which plugin commands the window may call, and with what scopes
e2e/                       Playwright specs driving the app in a browser (see Testing below)
```

Every component has a colocated `.module.scss`.

## Architecture rules this codebase actually follows

- **URL is the source of truth** for reading location, the active study-panel tab, and the
  verse highlight (`?from=&to=`). Routes: `src/App.tsx` (`HashRouter`).
- **Three state layers, nothing else** — no zustand/redux/jotai:
  1. `AppStateContext` (`state/AppStateContext.tsx`): Context + `useReducer`, mirrored to
     `localStorage` via `state/persist.ts`.
  2. TanStack Query for server state (`queries/*.ts`, key factory in `queries/keys.ts`).
  3. Route + search params for location/selection.
- **No component library, no Tailwind.** Styling is Sass Modules + a token system
  (`styles/_tokens.scss` → CSS custom properties in `_theme.scss`, shared mixins in
  `_mixins.scss`). There is no generic `Button`/`Dialog`/`Select` — copy the shape of a
  neighbour (`components/KeyDialog.tsx` is the modal pattern; `icons.tsx` holds inline SVGs).
- **All user-facing strings live in `data/strings.ts`** (`STR[locale]`, `Locale = "en" | "es"`).
  Adding a key to `StringsShape` without both `en` and `es` entries fails `yarn typecheck`.
- Imports are relative. There is no path alias.
- **Shell access goes through one of three places, never a plugin import at a call site**:
  `platform/index.ts` (`getPlatform()`) for Image Creator capabilities, `platform/host.ts` for
  `IS_MAC`, `lib/externalLinks.ts` for outbound links. `features/image-creator/**` in
  particular must stay platform-neutral — see docs/platform-abstraction.md. Most capabilities
  (file picker, clipboard) are plain web-platform APIs and need no shell call at all; only
  `saveImage` is Tauri-backed.
- **Every new Tauri plugin command needs a permission** in `src-tauri/capabilities/default.json`,
  and path/URL-scoped ones need their scope too. A missing permission fails at runtime, not at
  build time, with a "not allowed" error from `invoke`.

## Testing

Two layers, deliberately different in kind:

- **Vitest** (`yarn test`, `src/**/*.test.ts`) — pure logic only (serialization, presets, crop
  math, text layout, filenames, reducers). No DOM, no network, no shell. Per standing guidance:
  **mock any external/API call in a spec — never hit BibleQL, Unsplash, or any other live
  service from a test.**
- **Playwright E2E** (`yarn test:e2e`, `e2e/*.spec.ts`) — builds the frontend, serves it with
  `vite preview`, and drives it in headless Chromium like a user would: select verses, hand
  off to the editor, pick a background, edit text, export. It does **not** drive the Tauri
  window: `tauri-driver` has no macOS support at all, so a WebDriver suite could never run on a
  dev machine here. Instead `e2e/helpers.ts` installs a stub `window.__TAURI_INTERNALS__` that
  records every `invoke` call, which is what lets a spec assert "this opened in the system
  browser" (`plugin:opener|open_url`) rather than inferring it. Playwright's per-test browser
  context gives each test its own empty `localStorage`, so no profile-dir juggling is needed.
  This suite hits the real BibleQL API; Unsplash is always mocked via `page.route()`
  (50/hour shared quota — see docs/unsplash.md), though `UNSPLASH_ACCESS_KEY` still needs to be
  *some* non-empty value, since the app only renders the search tab's content when a key is
  configured.

## Gotchas

- **The os plugin returns `"macos"`, not Node's `"darwin"`.** `platform/host.ts` wraps this.
- **`platform()` throws outside a Tauri shell** (it reads `window.__TAURI_OS_PLUGIN_INTERNALS__`
  synchronously). `host.ts` catches and falls back to non-macOS — it runs at import time, so an
  uncaught throw there takes down the whole app in the browser E2E run. Any new module-scope
  shell call needs the same care.
- **Frameless window on macOS only** (`titleBarStyle: "Overlay"` + `hiddenTitle` in
  `tauri.conf.json`). Windows/Linux get normal OS decorations — Tauri has no equivalent of
  Electron's Window Controls Overlay, so there is no inset to reserve.
- **Drag regions use `data-tauri-drag-region`, not `-webkit-app-region: drag`.** The CSS
  property is a Chromium/Electron feature and is inert in WKWebView/WebKitGTK; the leftover
  `-webkit-app-region` rules in `TitleBar.module.scss` / `CreatorTopBar.module.scss` are
  harmless but are not what makes the bar draggable. Any new full-window route needs the
  attribute.
- **Tauri npm packages and Rust crates must match on major/minor**, or the app refuses to start
  with a "version mismatched Tauri packages" error. `tauri-plugin-http` is pinned to `~2.6` in
  `Cargo.toml` for exactly this reason (npm's latest stable is 2.6.1 while the crate is at
  2.7.0). Bump both sides together.
- `noUnusedLocals: true` in **all three** tsconfig projects — leftover scaffolding breaks
  `yarn typecheck`.
- `BIBLEQL_API_KEY` and `UNSPLASH_ACCESS_KEY` are compile-time inlined into the frontend bundle
  via `define:` in `vite.config.ts` (from `.env` / `.env.local`, dotenv, `.env.local` overrides)
  — see `docs/unsplash.md` for why the Unsplash key is safe to embed this way. The Anthropic key
  is deliberately **not** bundled — it's read from `localStorage` and passed per-call into
  `lib/ai.ts`. Follow the un-bundled pattern for any future secret; only ship a key at build
  time if it's meant to be public (as those two already are).
- **Only `api.anthropic.com` goes through Tauri's HTTP plugin**, because it refuses
  cross-origin requests. BibleQL and Unsplash both send `access-control-allow-origin: *` and
  must keep using plain `fetch` — routing them through the plugin would break the E2E suite,
  which mocks them at the network layer.
- **The HTTP plugin always sends an `Origin` header** — it strips the caller's as a forbidden
  header, then sets its own (`http://localhost:1420` in dev, `tauri://localhost` bundled); see
  its `commands.rs`, "ensure we have an Origin header set". Only the plugin's `unsafe-headers`
  cargo feature can suppress it. So going through Rust does *not* make a request look
  non-browser to the remote service: Anthropic still demands
  `anthropic-dangerous-direct-browser-access: true`, which `lib/ai.ts` sends. Expect the same
  from any other API that gates on Origin.
- `p[data-hl="on"]` (the verse-highlight rule) is defined **globally** in
  `styles/global.scss`, not scoped to a module — new `<p>` elements elsewhere inherit it.
- Reader/app preferences persist via `localStorage` only (`state/persist.ts`); the Image
  Creator's own project persistence (`.bibleql` files) hasn't been built yet. Any new file I/O
  should go through `platform/index.ts`, not straight to a Tauri fs call.
- **contentEditable + React don't mix well** (`features/image-creator/components/TextBox.tsx`).
  React stops reconciling a node's children once `contentEditable` is true, so the DOM keeps
  whatever the user typed even after state changes; when edit mode ends and React resumes
  rendering `{element.text}` as children, it doesn't know a text node is already sitting there
  and inserts its own alongside it — the committed text visibly doubles. Fix: explicitly clear
  the DOM node's `textContent` in the "commit" step, before flipping `contentEditable` back off.
  Also guard that commit function with a ref (not state) against being called twice in the same
  tick — a blur and a "deselected" prop change can both fire from one click.

## Git

The user commits their own work — do not run `git commit` unless explicitly asked to.

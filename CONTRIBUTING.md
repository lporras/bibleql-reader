# Contributing

Thanks for helping out with Bible Reader. You can contribute bug reports, fixes, translations or
features, and this guide covers each. For a small fix, open a pull request directly. For anything
bigger (a new feature, a new dependency, an architectural change), open an issue first so we can
agree on the approach before you write the code.

## Getting set up

You need [Node](https://nodejs.org) 22, [Yarn](https://yarnpkg.com) (not npm), a
[Rust toolchain](https://www.rust-lang.org/tools/install), and Tauri's
[system prerequisites](https://tauri.app/start/prerequisites/): Xcode command line tools on
macOS, WebView2 on Windows, `libwebkit2gtk` on Linux.

```bash
git clone git@github.com:<you>/bibleql-reader.git
cd bibleql-reader
yarn install
cp .env.example .env
yarn tauri dev        # desktop app with HMR
```

API keys are optional for most work:

- **`BIBLEQL_API_KEY`**: without it, the reader shows a bundled sample chapter (Psalm 23). You can
  get a free key at https://bibleql.org/api-keys/request/new.
- **`UNSPLASH_ACCESS_KEY`**: only needed for the Image Creator's Unsplash search tab. See
  [docs/unsplash.md](docs/unsplash.md).
- **Anthropic key**: entered at runtime from the key dialog in the title bar. It is never read
  from `.env`.

Never commit `.env` or `.env.local`.

For UI-only work, `yarn dev` serves the frontend in a regular browser at http://localhost:1420.
It's faster to iterate in, but native features (the Save As dialog, the AI assistant) need
`yarn tauri dev`.

The [README](README.md) covers Android builds.

## Before you open a pull request

Run the same checks CI runs:

```bash
yarn typecheck                                     # all three tsconfig projects
yarn test                                          # Vitest unit tests
yarn test:e2e                                      # Playwright, in headless Chromium
cargo check --manifest-path src-tauri/Cargo.toml   # the Rust shell
```

None of these need API keys. The first `yarn test:e2e` run may ask you to install Chromium
(`yarn playwright install chromium`).

CI runs all four on every pull request, including PRs from forks.

## How the code is organised

[CLAUDE.md](CLAUDE.md) is the detailed map of the codebase, covering layout, architecture rules
and known gotchas. It's written for AI agents but is just as useful to people. The rules that
come up most often in review:

- **Match the file next to yours.** There's no ESLint or Prettier, so copy the style, naming and
  structure of the neighbouring code. There's almost always a precedent.
- **Styling uses Sass Modules and the tokens in `src/styles/`.** Each component has a colocated
  `.module.scss`. Don't add a component library, Tailwind or CSS-in-JS.
- **State lives in three layers only:** `AppStateContext` (app preferences), TanStack Query
  (server data) and the URL (reading location and selection). Don't add Redux, Zustand or
  similar.
- **Every user-facing string goes in `src/data/strings.ts`, in both English and Spanish.**
  `yarn typecheck` fails if either is missing. If you don't speak Spanish, add your best attempt
  and mention it in the PR.
- **Shell access goes through `src/platform/`** (or `lib/externalLinks.ts` for outbound links),
  never through a Tauri plugin import in a component. `src/features/image-creator/` in particular
  must stay platform-neutral. See [docs/platform-abstraction.md](docs/platform-abstraction.md).
- **A new Tauri plugin command needs a permission** in `src-tauri/capabilities/default.json`.
  Without one, it fails at runtime rather than at build time.
- **Imports are relative.** There are no path aliases.
- **`noUnusedLocals` is on everywhere.** Remove leftover imports and variables.

## Tests

- **Unit tests** (`src/**/*.test.ts`, Vitest) cover pure logic only: no DOM, no network, no shell.
  Put them next to the code they test.
- **End-to-end tests** (`e2e/*.spec.ts`, Playwright) drive the built app like a user would.
  Helpers in `e2e/helpers.ts` stub the Tauri shell and record its calls, so a spec can assert on
  what the app asked the shell to do.
- **Never hit a live service from a test.** BibleQL responses come from
  `e2e/fixtures/bibleql.json`; if your spec needs a chapter that isn't there, add it. Mock
  Unsplash per spec with `page.route()`. Fork PRs get no secrets, so a test that needs a real key
  fails in CI.

If you fix a bug, add a test that would have caught it where that's practical. If you add a
feature, add a test that covers its main path.

## Pull requests

- Branch from `main` and keep each PR to one change. Unrelated cleanup goes in its own PR.
- Describe what changed, why, and how you tested it. For UI changes, include a screenshot or
  short recording, and note which platforms you tried (macOS, Windows, Linux, Android).
- If you bump a Tauri package, bump the matching Rust crate to the same major/minor version (and
  vice versa). A mismatch stops the app from starting.
- Update the README or `docs/` if you change how something is set up or used.

## Reporting bugs

Open an issue with:

- what you did, what you expected, and what happened instead
- your OS and version, and the app version (or commit, if running from source)
- the Bible translation and passage, if relevant
- any errors from the developer console (right-click, then Inspect, in `yarn tauri dev`)

## Bible texts

The app's code is MIT-licensed (see [LICENSE](LICENSE)). Bible translations served by BibleQL
keep their own licenses, so don't copy translation text into the repository beyond small test
fixtures.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

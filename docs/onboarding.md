# Onboarding

A guided tour of BibleQL Reader for developers joining the project. It covers the architecture,
then walks through how the four main features are built: the **AI Assistant**, the
**Concordance**, **Studies (sermons)**, and the **Verse Image Creator**.

Read it alongside [`CLAUDE.md`](../CLAUDE.md) (the rules and gotchas list) and the focused docs
in this folder: [platform-abstraction.md](platform-abstraction.md),
[offline-mode.md](offline-mode.md), [unsplash.md](unsplash.md).

---

## 1. Getting started

```bash
yarn                    # install (Yarn, not npm)
cp .env.example .env    # then fill in the keys below
yarn tauri dev          # desktop app: Rust shell + Vite dev server with HMR
yarn dev                # frontend only, in a browser at http://localhost:1420
```

Build-time keys (in `.env` / `.env.local`, inlined by `vite.config.ts`):

| Variable | Used by | Without it |
|---|---|---|
| `BIBLEQL_API_KEY` | `lib/graphql.ts` | Only downloaded (offline) translations can be read |
| `UNSPLASH_ACCESS_KEY` | Image Creator background search | The Unsplash search tab is hidden |

The **Anthropic key is not a build-time key.** Each user types their own into the key dialog
(`components/KeyDialog.tsx`); it is stored in `localStorage` (`biblereader.aikey`) and passed
into every AI call.

Before opening a PR, run:

```bash
yarn typecheck && yarn test && yarn test:e2e
cargo test --manifest-path src-tauri/Cargo.toml   # if you touched src-tauri/
```

---

## 2. Architecture at a glance

```
┌──────────────────────── Tauri 2 window (platform webview) ────────────────────────┐
│                                                                                  │
│  React 19 app (src/)                                                             │
│   ├─ routes/            ReaderPage · StudyPage · ImageCreatorPage                 │
│   ├─ components/        UI, one .module.scss per component                        │
│   ├─ features/image-creator/   self-contained, platform-neutral feature           │
│   ├─ state/             Context providers (prefs, annotations, studies, AI chat)  │
│   ├─ queries/           TanStack Query hooks → lib/graphql.ts → BibleQL           │
│   ├─ lib/               pure logic: refs, ai, aiText, pdf/, verseRanges…          │
│   └─ platform/          the ONLY place that talks to the shell                    │
│                                                                                  │
└──────────────┬──────────────────────────────┬────────────────────────────────────┘
               │ invoke / plugins             │ plain fetch (CORS-enabled)
      ┌────────▼─────────┐            ┌───────▼───────────────────────┐
      │ src-tauri (Rust) │            │ bibleql.org/graphql           │
      │ · plugins: http, │            │ api.unsplash.com              │
      │   fs, dialog,    │            └───────────────────────────────┘
      │   opener, os     │
      │ · offline.rs     │──► api.anthropic.com (via the HTTP plugin, see §4)
      │   (SQLite+FTS5)  │──► offline package host (reqwest)
      └──────────────────┘
```

The Rust side is a **thin shell**: plugin registration plus the `offline_*` commands. Almost all
product logic lives in TypeScript.

### 2.1 Routes

Defined in `src/App.tsx` with a `HashRouter`:

| Route | Page | Purpose |
|---|---|---|
| `/read/:bookId/:chapter[/:panel]` | `routes/ReaderPage.tsx` | The reader. `:panel` is the active right-hand tab: `ai`, `conc`, `search`, `marks`, `study`. `?from=&to=` highlights verses. |
| `/study`, `/study/:id` | `routes/StudyPage.tsx` | Sermon / lesson editor. `/study` redirects to the active study (or creates one). |
| `/create?t=&b=&c=&v=` | `routes/ImageCreatorPage.tsx` | Verse Image Creator, seeded from a verse selection. |

Route components are deliberately **thin**: they lay out children, and each child pulls its own
state. Don't pass app state down through props when a hook can read it.

### 2.2 The three state layers

There are exactly three — don't introduce zustand/redux/jotai:

1. **Context + `useReducer`** (`src/state/`), persisted to `localStorage` through
   `state/persist.ts`:
   - `AppStateContext` — locale, theme, translations (`transA`/`transB`), panel visibility,
     the Anthropic key, etc.
   - `AnnotationsContext` — favorites, highlights, notes.
   - `StudiesContext` — studies and the active one (reducer in `state/study.ts`).
   - `OfflineDownloadsContext` — in-flight translation downloads.
   - `AiChatContext` — the single app-wide AI chat transcript (not persisted).
2. **TanStack Query** for server data (`src/queries/*.ts`, one hook per BibleQL query, keys from
   `queries/keys.ts`).
3. **The URL** for location and selection (book/chapter, active tab, highlighted verses).

The provider order in `App.tsx` matters: `AiChatProvider` reads `AppStateContext`, and
`StudiesProvider` sits above the routes so a study survives navigating between reader and
study page.

### 2.3 Talking to BibleQL

`lib/graphql.ts` exports `gqlRequest(query, variables)` — a plain `fetch` POST with a bearer
token, a 15 s abort timeout, and errors normalized to `GraphQLRequestError`. Each query hook
in `queries/` defines its GraphQL string inline and wraps `gqlRequest` in `useQuery` /
`useInfiniteQuery`.

If a translation is **downloaded**, hooks read it from a local SQLite file instead (see
[offline-mode.md](offline-mode.md)). Chapters are always local; search and concordance are
remote-first with a local fallback.

### 2.4 The platform seam

Shell access goes through one of four modules, never a plugin import at a call site:

| Module | Gives you |
|---|---|
| `platform/index.ts` → `getPlatform()` | `pickImageFile`, `saveImage`, `saveDocument`, `openFile`, `copyImageToClipboard` |
| `platform/host.ts` | `IS_MAC` |
| `platform/offline.ts` | `offlineBible` (the `offline_*` Rust commands) |
| `lib/externalLinks.ts` | Opening URLs in the system browser |

(The one exception is `lib/ai.ts`, which hands the HTTP plugin's `fetch` to the AI SDK — see §4.)

New Tauri plugin commands need a permission in `src-tauri/capabilities/default.json`; a missing
one fails **at runtime** with a "not allowed" error.

### 2.5 Conventions

- **Strings:** every user-facing string lives in `data/strings.ts` under both `en` and `es`.
  `yarn typecheck` fails if one locale is missing a key.
- **Styling:** Sass Modules + tokens (`styles/_tokens.scss` → CSS variables in `_theme.scss`).
  No component library; copy a neighbour (`KeyDialog.tsx` is the modal pattern, `icons.tsx` holds
  inline SVGs).
- **Imports are relative**, no path aliases.
- **Bible references are structured.** Passages are stored as `bookId` + `chapter` + `verses[]`,
  never as a formatted string, so they re-render in the current locale.
  `lib/refs.ts#parseRef` turns "Juan 3:16-17" / "John 3" into that shape.
- **Pure logic is separated from React** so it can be unit-tested with Vitest (`*.test.ts`
  next to the file).

---

## 3. The reader (the hub everything hangs off)

`ReaderPage` = `TitleBar` + `Sidebar` (book/chapter picker, translation combo, offline button)
+ `ReaderPane` (one or two translation columns) + `StudyPanel` (right-hand tabs).

- `queries/usePassage.ts` fetches a chapter (local or remote).
- `hooks/useVerseSelection.ts` tracks the multi-verse selection in column A.
- `components/Reader/VerseActions.tsx` is the floating toolbar on a selection: favorite,
  highlight, note, **Add to study**, **Create image**, copy. (Read-aloud lives in `ReaderPane`
  via `hooks/useSpeech.ts` / `lib/speech.ts`.)
- `hooks/useOpenRef.ts` turns any reference string into a navigation to
  `/read/:book/:chapter/:panel?from=&to=`. The AI chips, concordance hits and search results all
  use it.

`components/StudyPanel/StudyPanel.tsx` keeps **every tab mounted** and hides the inactive ones
with the `hidden` attribute, so switching tabs never loses a chat, a concordance lookup or a
search. The active tab comes from the URL's `:panel` segment.

---

## 4. Feature: AI Assistant

A Bible-study chat backed by Claude. Answers come back as structured data (text + 2–5 verse
references), and each reference can be opened in the reader or added to the active study.

### Files

| File | Role |
|---|---|
| `lib/ai.ts` | `askAi()` — builds the system prompt, calls Anthropic via the Vercel AI SDK, maps errors to readable messages |
| `queries/useAi.ts` | `useAi()` — a TanStack `useMutation` around `askAi`, injecting locale + key from `AppStateContext` |
| `state/AiChatContext.tsx` | The single, app-wide transcript and `ask()` |
| `components/StudyPanel/AIAssistant.tsx` | Chat UI: suggestions, messages, reference chips, input |
| `lib/aiText.ts` + `components/StudyPanel/AiText.tsx` | Turns the model's free text into safe paragraphs/lists |
| `types/ai.ts` | `AiAnswer`, `AiReference` |
| `components/KeyDialog.tsx` | Where the user enters their Anthropic key |

### Request flow

```
AIAssistant.ask(q)
  └─ AiChatContext.ask(q, studyTitle?)          appends the user message
       └─ useAi().mutateAsync                   (useMutation)
            └─ lib/ai.ts askAi(q, locale, key, studyTitle)
                 └─ generateObject({ model: anthropic("claude-sonnet-5"),
                                     schema: AiAnswerSchema (zod),
                                     system: buildSystemPrompt(locale, studyTitle) })
                      └─ @ai-sdk/anthropic → tauriFetch → Rust → api.anthropic.com
  ◄─ { answer, references[] }                   appended as the assistant message
```

Things worth knowing:

- **Structured output.** `generateObject` with a zod schema
  (`{ answer: string, references: { ref, why }[] }`) means the UI never has to scrape references
  out of prose. A schema mismatch surfaces as a friendly "didn't match the expected format"
  error.
- **The system prompt** (`buildSystemPrompt`) sets language (en/es), a 120-word limit, a
  denomination-neutral tone, a formatting contract (blank-line paragraphs, `1.`/`-` lists, no
  headings), and asks for references written with book names in the user's language so
  `parseRef` can read them. On the study page it also names the study title, so open questions
  are answered for that sermon.
- **Why the Tauri HTTP plugin.** `api.anthropic.com` rejects cross-origin browser requests, so
  `createAnthropic` gets the plugin's `fetch` and the request is issued from Rust. The plugin
  still adds an `Origin` header, so we also send `anthropic-dangerous-direct-browser-access: true`.
  The allowed URL is scoped in `capabilities/default.json`. The long comment at the top of
  `lib/ai.ts` explains the reasoning — read it before changing anything here.
  BibleQL and Unsplash must **not** go through the plugin (it would break E2E mocking).
- **The key is never bundled.** It's read from `AppStateContext.aiApiKey` per call.
- **One transcript for the whole app.** The assistant appears in the reader's panel and in the
  study page sidebar; `AiChatContext` owns the messages so moving between them keeps the
  conversation. It is in-memory only (lasts as long as the window).
- **Rendering answers safely.** `parseAiText` normalizes whatever the model returns (inline
  outlines like "1. A 2. B", missing spaces after periods, Markdown emphasis, headings) into
  `p` / `ul` / `ol` blocks of text runs. `AiText` renders those as React elements — no HTML from
  the model ever reaches the DOM. It's covered by `lib/aiText.test.ts`.
- **Reference chips** (`renderRef` in `AIAssistant.tsx`): the reference button calls
  `useOpenRef`; the "+" button uses `useAddToStudy().fromRef()` to turn the string into a passage
  draft (`source: "ai"`, with the model's `why`) and adds it to the active study. A reference
  that doesn't parse is shown but disabled.

### Extending it

- Change the answer shape → update `AiAnswerSchema`, `types/ai.ts`, and the prompt together.
- Add a suggestion prompt → `s1..s3` (reader) / `ss1..ss3` (study page) in `data/strings.ts`.
- Tests mock nothing live: `lib/ai.test.ts` covers the pure parts; never call Anthropic from a
  spec.

---

## 5. Feature: Concordance

Look up a word in the current translation and get its surface forms, occurrence counts (total,
verses, Old/New Testament) and a paginated list of verses with the hit highlighted.

### Files

| File | Role |
|---|---|
| `components/StudyPanel/Concordance.tsx` | Form, summary card, hit list, "Load more" |
| `queries/useConcordanceSupport.ts` | Is this translation indexed? (`translation.concordanceIndexedAt`) |
| `queries/useConcordance.ts` | The paginated lookup (`useInfiniteQuery`) |
| `queries/useOfflineInstalled.ts` | `useOfflineSource()` and `remoteFirst()` — local vs remote routing |
| `platform/offline.ts` → `src-tauri/src/offline.rs` | Local concordance over the package's FTS5 index |
| `lib/format.ts` | `stripMarkContext()` splits `…<mark>word</mark>…` into pre/hit/post |

### Flow

1. The user submits a word; the component stores it in local state (`word`).
2. `useConcordanceSupport(transA)` checks whether BibleQL has indexed this translation. It's a
   separate query (10-minute `staleTime`) so re-submitting words doesn't re-check support. A
   downloaded translation is always "supported" because it carries its own index.
3. If unsupported, the notice lists which translations *are* indexed (from `useTranslations`).
4. `useConcordance(transA, word, enabled)` runs the GraphQL query:

   ```graphql
   concordance(translation:$t, word:$w, first:25, after:$a) {
     totalCount
     entry { surfaceForms totalOccurrences verseCount occurrencesByTestament { old new } }
     edges { node { context verse { bookName chapter verse } } }
     pageInfo { hasNextPage endCursor }
   }
   ```

5. Only page 1's `entry` is shown; hits from all pages are flattened. Each hit's reference opens
   in the reader via `useOpenRef`.

### Online/offline routing (the subtle part)

- The first page goes through `remoteFirst(isLocalNow(), remote, local)`: BibleQL when reachable,
  the local SQLite index when offline or on any remote error.
- **Local cursors are prefixed `local:`.** When "Load more" fires, `queryFn` looks at the cursor
  prefix to stay on the same source as page 1 — a server cursor means nothing to the local index
  and vice versa.
- Call `offline.isLocalNow()` **inside `queryFn`**, not a value captured at render time
  (installing a translation invalidates queries before the hook re-renders).
- Pass `offline.networkMode`. TanStack pauses default `"online"` queries when the OS reports no
  network, which would freeze local reads.
- Local results match the server's numbers exactly (verified against production; see
  [offline-mode.md](offline-mode.md) "How local answers match the server").

The **Search** tab (`SearchTab.tsx` + `queries/useSearch.ts`) follows the same pattern and is a
good second example.

---

## 6. Feature: Studies (sermons & lessons)

A study is a sermon or lesson in preparation: a **title**, a **rich-text body**, and a list of
**passages** collected from the reader or the AI. It can be exported as a PDF.

### Data model (`types/study.ts`)

```ts
Study        { id, title, descriptionHtml, passages: StudyPassage[], createdAt, updatedAt }
StudyPassage { id, bookId, chapter, verses: number[], translationId,
               text,          // snapshot of the verse text ("" until fetched)
               source: "reader" | "ai", why, addedAt }
StudiesState { studies: Study[], activeId: string | null }
```

### Files

| File | Role |
|---|---|
| `state/study.ts` | Pure reducer + helpers (`samePassage`, `passageReference`, `translationAbbrev`…). Unit-tested in `study.test.ts`. |
| `state/StudiesContext.tsx` | Provider: `useReducer`, debounced `localStorage` writes, `actions` API |
| `state/studyImages.ts` | Images in the body, stored in IndexedDB |
| `hooks/useAddToStudy.ts` | Shared "Add to study" logic for the verse toolbar and AI chips |
| `routes/StudyPage.tsx` | Study page layout; `StudyRedirect` for `/study` |
| `components/Study/StudyEditor.tsx` | TipTap editor + our own toolbar |
| `components/Study/PassageCard.tsx` | A passage: text backfill, open in reader, insert as quote, reorder, remove |
| `components/Study/StudyList.tsx`, `StudyTopBar.tsx` | Sidebar list; top bar with PDF export |
| `components/StudyPanel/StudyView.tsx` | Compact view of the active study inside the reader panel |
| `lib/pdf/` | Dependency-free PDF generation |

### The "active study" concept

`StudiesState.activeId` is the study that **Add to study** feeds.

- `actions.addToActive(passages)` adds to the active study, or **creates one** if there is none,
  so the first "Add to study" never needs a separate create step.
- Opening `/study/:id` makes that study active (effect in `StudyPage`). That way you can jump to
  the reader from a study, add verses, and they land back in the study you were writing.
- Deleting the active study falls back to the most recently edited one.

### Adding passages

`useAddToStudy()` is used by both entry points:

- **Reader** (`VerseActions`): book/chapter/selected verses, with the text already known,
  `source: "reader"`.
- **AI chip**: `fromRef("Juan 3:16-17", why)` → parsed draft with empty text, `source: "ai"`.

Every passage is stamped with the **current primary translation** (`transA`). Dedupe
(`samePassage`) is by translation + book + chapter + verse set, so the same verses in two
translations are intentionally allowed.

AI passages arrive without text. `PassageCard` notices `!passage.text`, fetches the chapter with
`usePassage` (sharing the reader's cache), and calls `setPassageText` once. That backfill does not
bump `updatedAt`. From then on the study and its PDF work offline.

### Persistence

- The whole store is one JSON blob in `localStorage` (`biblereader.studies`). Since the body is
  written on every keystroke, writes are **debounced (300 ms)** and flushed on `pagehide`.
- **Images are not stored in the HTML.** `saveStudyImage` downscales to ≤1600 px, stores the blob
  in IndexedDB (`biblereader` DB, `studyImages` store), and returns `study-image:<id>`. The editor's
  custom `StudyImage` node view resolves that to an object URL. Orphaned images are pruned on the
  next launch (not immediately, so undo can still bring one back).

### The editor and the PDF must agree

The body is TipTap (ProseMirror). Its schema acts as the sanitizer: pasted Word/Docs/web content
is reduced to the allowed nodes and marks. The allowed set is **exactly** what
`lib/pdf/studyPdf.ts` can lay out: paragraphs, two heading levels, bold, italic, links, bullet
and numbered lists, blockquotes, text alignment, horizontal rules, images, and YouTube embeds
(printed as their watch URL).

> **Rule:** enable a new TipTap node or mark only together with its PDF rendering.

"Insert" on a `PassageCard` puts a `<blockquote>` with the text and a bold
"John 3:16 (WEB)" citation at the caret, via the editor's `insertHtml` handle.

### PDF export

```
StudyTopBar.exportPdf
  └─ renderStudyPdf(study, locale)           lib/pdf/studyPdf.ts  (browser-dependent glue)
       ├─ htmlToBlocks(descriptionHtml)      DOM parse → Block[] (runs with bold/italic/href)
       ├─ studyBlocks(study, locale, body)   title + body + "Passages" section
       ├─ layoutBlocks(blocks, measure)      lib/pdf/layout.ts   (pure: wrapping, pagination)
       └─ writePdf(doc)                      lib/pdf/writer.ts   (pure: PDF objects → bytes)
  └─ getPlatform().saveDocument({ data, suggestedName, mimeType: "application/pdf" })
  └─ getPlatform().openFile(path)            opens it in Preview / the default viewer
```

- Uses the **standard 14 PDF fonts**, so text must be **WinAnsi**: `toWinAnsiText` (`winAnsi.ts`)
  folds anything outside it. No font embedding.
- Text is measured with a canvas (`canvasMeasure`) so wrapping matches the fonts the PDF uses.
- `layout.ts` and `writer.ts` are pure and tested in `pdf.test.ts`; keep browser APIs in
  `studyPdf.ts`.

---

## 7. Feature: Verse Image Creator

Select verses in the reader → **Create image** → style them over a background → export a PNG or
JPEG at a social-media size. It lives in `src/features/image-creator/` and must stay
**platform-neutral** (no Tauri imports; use `getPlatform()`). See
[platform-abstraction.md](platform-abstraction.md).

### Folder map

| Folder | Contents |
|---|---|
| `model/` | `types.ts` (the serializable project), `defaults.ts`, `presets.ts` (canvas sizes), `fonts.ts`, `crop.ts` (cover-fit math), `coords.ts`, `serialize.ts` |
| `state/reducer.ts` | `imageCreatorReducer`: `REPLACE_PROJECT`, `SET_BACKGROUND`, `SET_CROP`, `SET_OVERLAY`, `SET_CANVAS`, `SELECT_ELEMENT`, `MOVE_ELEMENT`, `RESIZE_ELEMENT`, `UPDATE_ELEMENT` |
| `components/` | `CreatorTopBar` (preset + export), `BackgroundPanel`, `UnsplashSearch`, `ScripturePanel`, `EditorCanvas`, `TextBox`, `PropertiesPanel`, `FontPicker`, `ExportControls`, `PhotoCredit` |
| `providers/` | Background sources: `ImageProvider` interface, `UnsplashProvider`, curated images, local file picker |
| `assets/imageAssets.ts` | In-memory cache of decoded images keyed by `assetId` |
| `rendering/` | `renderProject.ts` (canvas export), `textLayout.ts` (line wrapping) |
| `lib/` | `scriptureText.ts`, `attribution.ts`, `filename.ts` |
| `data/curatedImages.ts` | The bundled backgrounds in `public/bible-images/` |

### Handoff from the reader

`ReaderPane.createImage` navigates to
`/create?t=<translation>&b=<book>&c=<chapter>&v=<encoded verses>`. `ImageCreatorPage` decodes the
params, fetches the chapter with `usePassage`, and once data arrives builds a `BibleSource` and
dispatches `REPLACE_PROJECT` with `createDefaultProject(bibleSource, scriptureText)` (a guarded,
run-once effect). With no params it opens an empty project.

### The model: everything normalized

`ImageCreatorProject` stores positions and widths as **fractions (0..1) of the canvas**, and
`fontSize` as a fraction of canvas **height**. This one decision means:

- the DOM preview (`EditorCanvas`, scaled to fit the window) and the full-resolution export agree
  on layout;
- switching preset (Instagram story → square) is a re-render, not a re-layout.

Text elements have a `kind` (`scripture`, `reference`, `custom`) plus font, color, alignment,
line height, optional shadow and background box. The scripture text and reference are built from
structured data (`buildScriptureText`, `buildReference`), never from a pre-formatted string.

### Backgrounds

Three sources, all producing a `Background` (`type: "local" | "unsplash" | "curated"`) whose
decoded image lives in `assets/imageAssets.ts` under `assetId`:

- **Curated:** bundled images under `public/bible-images/{thumb,full}/`.
- **Local file:** `getPlatform().pickImageFile()` returns an object URL (not base64).
- **Unsplash:** `UnsplashProvider` uses `unsplash-js` with the public Client-ID key. Components
  only talk to the `ImageProvider` interface. Unsplash rules we must honour (see
  [unsplash.md](unsplash.md)): fire `triggerDownload` with the API's own `download_location`
  when a photo is *used*, keep attribution on the background, and mind the 50 req/hour shared
  demo quota.

`crop` (`x`, `y`, `scale ≥ 1`) and the optional color `overlay` are applied with the same
`coverRect` math in preview and export.

### Editing text

`TextBox.tsx` handles drag, resize and in-place editing with `contentEditable`. Read the
contentEditable + React note in `CLAUDE.md` before touching it: clear `textContent` before
leaving edit mode, and guard the commit with a ref, or the text will double.

### Export

`ExportControls` → `renderProject(project, { format })` draws onto an offscreen canvas at the
preset's real pixel size: background (cover-cropped, `crossOrigin = "anonymous"` so an Unsplash
image doesn't taint the canvas), overlay, then each text element with `wrapLines`. The resulting
blob goes to:

- `getPlatform().saveImage()` — native Save As dialog plus file write (the only Tauri-backed
  capability; filename from `lib/filename.ts`);
- or `getPlatform().copyImageToClipboard()` — the standard Async Clipboard API.

---

## 8. Testing

| Layer | Command | What goes there |
|---|---|---|
| Vitest | `yarn test` | Pure logic: reducers (`study.test.ts`, image-creator `reducer.test.ts`), `aiText`, refs/verse ranges, PDF layout/writer, crop math, presets, serialization. No DOM, network or shell. |
| Playwright | `yarn test:e2e` | The built frontend in headless Chromium: `verse-selection`, `study`, `image-creator`, `unsplash-search`, `offline`, `read-aloud-android` specs. |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | `offline.rs` against an in-memory SQLite. |

E2E specifics (`e2e/helpers.ts`):

- `launchApp` answers **every BibleQL request** from `e2e/fixtures/bibleql.json`. Add the chapter
  there if your spec needs a new one.
- Unsplash is mocked per spec with `page.route()`.
- A stub `window.__TAURI_INTERNALS__` records every `invoke`, so a spec can assert on shell calls
  (e.g. `plugin:opener|open_url`, `offline_*`).
- **Never hit a live service from any test**: BibleQL, Unsplash, Anthropic.

---

## 9. Common tasks: where to start

| I want to… | Start in |
|---|---|
| Add a BibleQL query | New hook in `queries/`, key in `queries/keys.ts`, types in `types/bible.ts`. If it should work offline, follow `useConcordance.ts`. |
| Add a UI string | `data/strings.ts`, both `en` and `es` |
| Add a study-panel tab | `PANELS` + a button in `StudyPanel.tsx`; keep it mounted with `hidden` |
| Change what the AI returns | `lib/ai.ts` (schema + prompt), `types/ai.ts`, `AIAssistant.tsx` |
| Add a formatting option to studies | `StudyEditor.tsx` **and** `lib/pdf/studyPdf.ts` (+ `layout.ts` if it's a new block style) |
| Add a canvas preset | `features/image-creator/model/presets.ts` |
| Add an image source | Implement `ImageProvider` in `features/image-creator/providers/` |
| Call something native | Add it to `PlatformCapabilities` (`platform/types.ts`), implement it in `platform/tauri.ts` / `web.ts`, add the permission in `capabilities/default.json` |
| Persist a new preference | `state/AppStateContext.tsx` (state, action, reducer) + `state/persist.ts` |

When in doubt, find the nearest similar feature and copy its shape. There's almost always
precedent, and `CLAUDE.md`'s **Gotchas** section lists the traps people have already hit.

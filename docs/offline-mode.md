# Offline translations

A reader can download a translation, and from then on its chapters are read from a local SQLite
copy instead of the BibleQL API. Search and concordance still go to BibleQL whenever it's
reachable, and use the local copy offline, or when the request fails (for example Wi-Fi with no
internet, or a translation the server has no concordance index for). A downloaded translation
works with no network at all, and needs no API key.

## Where the packages come from

BibleQL publishes some translations as offline packages. Which ones is a licensing call made
server-side; see the server's `docs/offline_mode.md` and
<https://docs.bibleql.org/guides/offline-packages>. The GraphQL contract:

```graphql
translations {
  identifier
  offlineDownloadable
  offlinePackage(schemaVersion: 1) { url sha256 sizeBytes updatedAt }
}
```

`offlinePackage` is null when a translation can't be redistributed or hasn't been exported yet.

The package:
- **File.** A gzipped SQLite file at an immutable, content-addressed URL. A new export gets a new
  URL.
- **Checksum.** `sha256` is of the **compressed** bytes.
- **Schema v1.**
  - Tables:
    - `meta(key, value)`
    - `books(id, code, name, testament, chapters)`. `code` is `GEN`/`JHN`, the same ids as
      `src/data/books.ts`, and `name` is localized.
    - `verses(id, book_id, chapter, verse, text)`. `id` is in canonical order.
    - `verses_fts`, an FTS5 table using `unicode61 remove_diacritics 2`.
  - Pragmas: `application_id = 0x42514C31` ("BQL1") and `user_version = 1`.

The package host (an R2 bucket) sends **no CORS headers**, so the webview can't `fetch` a
package. That is why the download lives in Rust.

## The pieces

| Layer | File | Role |
|---|---|---|
| Rust | `src-tauri/src/offline.rs` | `offline_list / install / cancel / remove / passage / search / concordance` commands. Downloads with the http plugin's re-exported `reqwest`, verifies sha256, gunzips, then checks the pragmas and `meta.translation_identifier` before an atomic rename into `<app data>/offline/<id>.sqlite` (plus an `<id>.json` sidecar holding the sha). Read-only connections are cached per translation. |
| Shell seam | `src/platform/offline.ts` | `offlineBible`, the only place that `invoke`s these commands. Outside a shell, `list()` is `[]`, so a browser build always uses GraphQL. |
| Server state | `queries/useOfflineInstalled.ts`, `queries/useOfflineAvailability.ts` | The installed list (from Rust) and the published packages (from BibleQL). An update is available when the published sha256 differs from the installed one. |
| Routing | `usePassage`, `useSearch`, `useConcordance`, `useConcordanceSupport` | If the translation is installed, `usePassage` reads locally. `useSearch` and `useConcordance` go through `remoteFirst()`: BibleQL when online with a key, otherwise (or on any error) the local index. Local concordance cursors are prefixed `local:`, so "Load more" stays on the source page 1 came from. Query keys are unchanged, because the result shapes are identical. Each hook waits for the first installed list (`ready`), so an installed translation never makes a stray network request at startup. Local queries also set `networkMode: "always"`. TanStack's default `"online"` mode pauses every query while the OS reports no network, so with Wi-Fi off the reader would sit on the previous chapter. |
| Downloads | `state/OfflineDownloadsContext.tsx` | Progress and errors for in-flight downloads. It sits above the routes so a download survives the sidebar folding away. On success or removal it updates the installed list and invalidates every query keyed on that translation id. |
| UI | `components/Sidebar/OfflineButton.tsx` | Sits under each translation picker. When the sidebar is hidden (narrow windows, phones), a compact form appears in the title bar. Installed translations get an "offline" badge in the picker. |

The translations list itself is cached in `localStorage` (`biblereader.translations`), so the
picker shows real names offline. Installed translations are always merged into it.

## How local answers match the server

These were checked against production for spa-rv1909 and eng-kjv:

- **Passage.** The reference is `books.name + " " + chapter` ("Juan 3"). `translationName` comes
  from `meta.translation_name` and `translationNote` from `meta.license_note`. The verse text is
  byte-identical to the API, stray newlines included.
- **Search.** Every whitespace token is quoted, so FTS5 syntax characters are literal, and the
  tokens are ANDed. Results are ordered by FTS5 `rank`, limit 40.
- **Concordance.**
  - `totalCount` and `verseCount` are the number of matching verses.
  - `totalOccurrences` counts whole-word matches after folding case and diacritics.
  - `occurrencesByTestament` counts **verses** per testament, as the server's does.
  - `context` is FTS5 `snippet()` with `<mark>` tags.
  - Cursors are canonical verse ids. Only the first page carries `entry`, because the UI only
    reads `pages[0].entry`.
  - For "espiritu" in RV1909 this gives 560 verses, 616 occurrences and OT 241 / NT 319, exactly
    what the API returns. The ignored `real_rv1909_package_matches_the_server` test pins this.

## Testing

- `cargo test --manifest-path src-tauri/Cargo.toml` runs the unit tests against an in-memory DB
  with the real DDL: the query sanitiser, folding, passage, search, and concordance counts and
  paging.
- Two opt-in tests (`-- --ignored`) touch real data:
  - `OFFLINE_PACKAGE=<path to an unpacked spa-rv1909 .sqlite>` compares one package with
    production.
  - `OFFLINE_PACKAGE_URL=<url> OFFLINE_PACKAGE_SHA=<sha>` downloads and installs a package for
    real, and checks that a bad checksum leaves nothing behind.

  Neither runs by default, which keeps the rule that tests never hit live services.
- `e2e/offline.spec.ts` answers the `offline_*` commands through the stub `__TAURI_INTERNALS__`
  (`launchApp(page, route, { offline_list: [...] })`). It asserts the download call, and that an
  installed translation makes no `passage(` GraphQL request. `eng-web` in
  `e2e/fixtures/bibleql.json` carries a fake `offlinePackage`.

## Platforms

- Desktop and Android use the same code. The `bundled` feature compiles SQLite with FTS5 in, so
  the platform's own SQLite never matters; Android cross-compiles with the NDK.
- iOS has no project in this repo yet (`src-tauri/gen/apple`). Nothing here is
  platform-specific, but it hasn't been built.

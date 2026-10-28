# Unsplash integration

Live search of Unsplash's library for Verse Image Creator backgrounds. This documents the
decisions the spec (`plan bible image.md` §8) asked to have recorded here, verified against
Unsplash's current documentation and a live API call as of 2026-09 (not just recalled from
memory — API terms can change; re-verify before a release if this integration is touched again).

## Through BibleQL — no Unsplash key in the app

The app never talks to `api.unsplash.com`. It asks BibleQL, which holds the Unsplash access key on
the server and makes the Unsplash calls itself:

- `backgroundImages(query, page, perPage)` — search. Returns each photo's CDN URLs
  (`urls.regular/small/thumb`), size, photographer (`name`, `username`, `profileUrl`) and
  `unsplashUrl`, plus `page`, `totalPages`, `hasMore`. When Unsplash fails, the server sends no
  GraphQL error. It returns an empty `images` list and an `errorCode`:
  - `RATE_LIMITED` — Unsplash's quota; the server backs off for 5 minutes.
  - `UNAVAILABLE` — a timeout, a 5xx, or a bad body.
  - `NOT_CONFIGURED` — the server has no key.

  The server caches successful searches for 12 hours, keyed by the normalized query and page.
- `trackImageDownload(input: { imageId })` — the download ping (see below). Returns
  `{ queued }` straight away; the server pings Unsplash from a background job.

Both fields exist **only for installation keys** — the per-install token every copy of the app
registers on first launch (see [installation-keys.md](installation-keys.md)). With a developer
key, the schema doesn't contain them.

Client side: `features/image-creator/providers/BibleQLImageProvider.ts` implements the
`ImageProvider` interface on top of `lib/graphql.ts`'s `gqlRequest`. It turns an `errorCode` into
an `ImageSearchError`, and `UnsplashSearch.tsx` shows a localized message for it.
`providers/mapBackgroundImage.ts` maps each result.

### History: why this moved server-side

Until 0.4 the app embedded `UNSPLASH_ACCESS_KEY` at build time and called Unsplash with
`Authorization: Client-ID …` through `unsplash-js`. Unsplash documents that flow for installed
apps, but in practice it meant:

- every install drew on one shared quota (50 requests/hour in Demo mode, 1,000 in Production);
- anyone could pull the key out of the binary;
- the key couldn't be rotated without shipping a release.

With the key on the server it can be rotated freely, popular searches are answered from the cache,
and BibleQL's per-installation rate limits apply. Rotating the old key cuts off Unsplash search
in pre-0.4 releases only; Bible reading is unaffected.

## Only free photos

Unsplash+ (their separate paid stock library) isn't mentioned anywhere in the public API
documentation's photo object fields, request parameters, or the `/search/photos` endpoint —
there's no `plus`/`premium` flag to filter on, and nothing suggesting the public search API
returns anything but the regular, free Unsplash-licensed library. In practice, the public
developer API and Unsplash+ appear to be separate products entirely; the server only ever talks
to the former, so "only free photos" is the API's default behavior here, not something anyone
has to filter for.

## Attribution — mandatory, UTM-tagged

Per the [API Guidelines](https://help.unsplash.com/en/articles/2511315-api-guidelines), every use
of a photo obtained via the API must display: **"Photo by `<photographer>` on Unsplash"**, both
the photographer's name and "Unsplash" as links, each carrying `utm_source=bibleql-reader` and
`utm_medium=referral`.

This is built once, in `features/image-creator/lib/attribution.ts`
(`buildUnsplashAttribution`), and shared by **both** the curated local library
(`data/curatedImages.ts`) and live search (`providers/mapBackgroundImage.ts`) — a photo's origin
doesn't change the compliance requirement. The server's `profileUrl` / `unsplashUrl` may already
carry the UTM parameters; `withUtm` *sets* them rather than appending, so they are never doubled.

It's rendered in one place too: `components/PhotoCredit.tsx`, used under **every** search-result
thumbnail, under **every** curated thumbnail, and for the selected background. (The grids
previously had the credit only as `title`/`alt` hover text. Strictly, the guideline's "applies to
all uses and not just search results" sentence belongs to the *hotlinking* rule rather than the
attribution one — but visible credits are what a reviewer sees in a screenshot, and it's the
easier thing to defend.) Word order comes from the translated `photoBy` template via
`lib/format.ts`'s `splitTemplate`, not from the component, so Spanish reads "Foto de … en …"
naturally. Both grids are two columns rather than three to make room for the caption.

### ⚠️ The photographer's @handle is not derivable from the filename

The curated entries used to guess the profile URL as `unsplash.com/@{name-slug}`, taking the slug
from Unsplash's download filename convention (`{name-slug}-{11-char-photo-id}-unsplash.jpg`).
That slug is a slugified *display name*, which is a different thing from the account handle —
**all six links 404'd.** Verified against unsplash.com on 2026-09-15:

| photo id | old guess (dead) | actual handle | display name |
|---|---|---|---|
| `9zsHNt5OpqE` | `@aaron-burden` | `aaronburden` | Aaron Burden |
| `Ncn1jiEe-Wc` | `@aaron-burden` | `aaronburden` | Aaron Burden |
| `kBybHJ3CEWI` | `@alicia-quan` | `alicia2joy` | Alicia Quan |
| `DRgrzQQsJDA` | `@rod-long` | `rodlong` | Rod Long |
| `GVRRtaLj3LU` | `@samuel-mcgarrigle` | `tempographics` | Samuel McGarrigle |
| `y2-FG8oiSiQ` | `@wesley-tingey` | `wesleyphotography` | Wesley Tingey |

Display name and handle are now explicit per-entry fields on `CuratedImageSource`, and the
derivation helper is gone, so a slug-derived URL can no longer be expressed.
`data/curatedImages.test.ts` asserts the shape (handles are `[a-z0-9_]+`, never equal to the old
derivation, URLs UTM-tagged) but **cannot prove a handle exists** — verify any new entry, and
re-verify all of them before re-submitting, by opening the photo page by hand.

## Curated library and the hotlinking rule

The six photos under `public/bible-images/` are bundled with the app rather than
hotlinked. That's deliberate and permitted: they were downloaded from unsplash.com under the
**Unsplash License**, not obtained through the API, and the hotlinking rule governs "all API
uses". They're what makes the Image Creator usable offline, which is why the curated tab is the
default. Everything that *does* come from the API is hotlinked — see below.

## Triggering a download

The guideline asks for a request to the photo's `links.download_location` whenever a user
actually *uses* a photo. This is not for the image bytes — it's purely an analytics counter. That
URL carries a signed `ixid` tying the event to the search it came from. The server keeps each
photo's `download_location` from the search it served (for 24 hours) and pings exactly that URL.
The app only sends the photo id (`trackImageDownload`). It never sends a URL, so it has no URL
to validate and no key to leak.

**When it fires:** on **selecting a search result as the background**
(`selectUnsplashBackground` in `BibleQLImageProvider.ts`). It is fire-and-forget, so a slow or
failed ping never blocks the editor. That's the guideline's "when a user does something with the
photo, usually inserting or setting it somewhere" — explicitly *not* the moment a result is
merely displayed in the grid. It is not fired again at export time: exporting the finished
design is a different action on a different (final, composited) image.

## Hotlinking and canvas export

Photos are used exactly as Unsplash's guideline requires: the CDN URL (`urls.regular`) is used
directly as the background's image source. It is never downloaded, rehosted or cached to disk,
and BibleQL passes Unsplash's URLs through unchanged rather than proxying the image bytes. This
matters for the export renderer too: `images.unsplash.com` sends
`Access-Control-Allow-Origin: *` (verified live), which is what allows a `<canvas>` to read the
pixels back out for `toBlob()`/clipboard export without a `SecurityError`. Both the editor's
preview `<img>` (`EditorCanvas.tsx`) and the export loader (`rendering/renderProject.ts`) set
`crossOrigin="anonymous"` for the *same* URL — asking for CORS mode inconsistently for one
resource can make the browser reuse a cached non-CORS ("opaque") response either way, tainting
the canvas regardless of what the second request asks for.

## Opening attribution links

An attribution link that doesn't work isn't attribution. A webview left to itself navigates the
app away to unsplash.com — no address bar, no back button, no way home — which is a poor
substitute for the user's own browser. `src/lib/externalLinks.ts` (`attachExternalLinkHandling`,
called once from `src/main.tsx`) installs a single delegated click listener:

- same-origin links (the HashRouter's own `#/...` routes) pass through untouched;
- any link leaving the origin is cancelled, and `https:` URLs are handed to `openUrl()` from
  Tauri's opener plugin;
- everything else (`file:`, `about:`, custom schemes) is dropped silently.

This lives in `lib/` rather than behind `platform/index.ts` because there's no per-shell API
surface involved — it's one document-level listener, not a capability the Image Creator calls.
`features/image-creator/**` stays platform-neutral either way.

(Under Electron this was the main process's job — `setWindowOpenHandler` returning
`{ action: "deny" }` plus a `will-navigate` guard, handing URLs to `shell.openExternal`. Tauri has
no main process to put that in, hence the move into the page.)

Note `rel="noreferrer"` on those anchors does *not* strip the UTM parameters; they live in the
URL, not the `Referer` header.

## Testing

Per this project's standing rule, specs never call a real API:

- **Vitest**:
  - `providers/mapBackgroundImage.test.ts` tests the response mapping against fixture data
    (`providers/__fixtures__/backgroundImages.ts`, in the shape BibleQL returns): CDN URLs passed
    through, fallbacks for fields Unsplash left out, and UTM parameters never doubled.
  - `lib/attribution.test.ts` covers building the attribution.
  - `data/curatedImages.test.ts` covers verified handles, UTM-tagged URLs and root-absolute asset
    paths.
  - `src/lib/format.test.ts` covers `splitTemplate`, which `PhotoCredit` renders through.
  - None of them touch the filesystem: `tsconfig.json` has no node types on purpose, since the
    frontend runs in a webview.
- **E2E** (`e2e/image-search.spec.ts`):
  - `launchApp`'s mocked BibleQL answers `backgroundImages` from
    `e2e/fixtures/background-images.json`, and `trackImageDownload` with `{ queued: true }`.
    Every request is recorded (`bibleqlRequests`).
  - The spec asserts that search carries the installation token, that selecting a photo sends
    `trackImageDownload` with that photo's id, and that merely displaying results doesn't.
  - It asserts that an `errorCode` shows its message.
  - It asserts that **nothing ever requests `api.unsplash.com`**. A route aborts and records any
    such call, and every test checks the list is empty.
  - Attribution assertions are scoped to `getByTestId("selected-attribution")`, because every
    thumbnail has its own credit links.
  - `e2e/image-creator.spec.ts` additionally asserts that a curated photographer link resolves
    to the verified handle, and that clicking a credit opens no second window.
  - `images.unsplash.com` (the photo bytes) is left un-mocked: CDN requests don't count against
    any API quota.

## Production access checklist

Audited against the [API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)
(re-fetched 2026-09-15) for the "Apply for Production" review. One row per checklist item, with
the file that implements it, so this can be re-verified later without re-auditing from scratch.

| Requirement | Where it's implemented |
|---|---|
| Photos hotlinked to the original Unsplash URL | BibleQL returns Unsplash's `urls` unchanged. `providers/mapBackgroundImage.ts` passes `urls.thumb`/`urls.regular` straight through, and `BibleQLImageProvider.ts` stores the CDN URL as the asset's `objectUrl`. Images are never downloaded, proxied or cached. The six bundled curated photos are Unsplash-License downloads, not API uses (see above). |
| Download triggered on use | `selectUnsplashBackground` sends `trackImageDownload`. The server pings the photo's `links.download_location` verbatim (`ixid` included). |
| No Unsplash logo; name not similar to "Unsplash" | App is **BibleQL Reader** (`package.json` `productName`, appId `org.bibleql.reader`). No Unsplash logo asset in the repo; the Background tab is labelled generically ("Search"/"Buscar"). |
| Accurate app name and description | Submitted description kept in sync with this document's opening paragraph. |
| Photographer and Unsplash attributed and linked | `components/PhotoCredit.tsx` renders the credit under every search thumbnail, every curated thumbnail, and for the selected background. `lib/attribution.ts` UTM-tags both links, and they open in the system browser via `src/lib/externalLinks.ts`. |

**Description submitted to Unsplash** (keep this and the dashboard entry identical):

> A free desktop Bible reader (macOS/Windows/Linux). Its Verse Image Creator lets a reader select
> verses and compose them over a background photo, exported as PNG/JPEG for personal or church
> use. Unsplash powers optional background search through the BibleQL server: photos are always
> hotlinked from images.unsplash.com and never rehosted, every photo displays "Photo by
> \<photographer\> on Unsplash" with both links UTM-tagged, and a download is triggered via
> `links.download_location` the moment a photo is set as a background.

Before submitting, confirm `APP_SLUG` in `features/image-creator/lib/attribution.ts` still matches
the `utm_source` the Unsplash app dashboard expects, and re-verify the six curated handles.

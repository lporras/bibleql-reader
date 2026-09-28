# Platform abstraction

The app is Tauri today. It was Electron until the migration, and the Image Creator was built
against this seam specifically so the shell could be swapped without a rewrite — which is what
happened: only `saveImage` needed a new implementation. This document describes the seam and
what's on each side of it.

## The interface

`src/platform/types.ts` declares `PlatformCapabilities` — everything the Image Creator's domain
code is allowed to assume about the host environment. Domain/model code
(`src/features/image-creator/**`) must call into this interface, never a Tauri plugin API
directly.

```ts
export interface PlatformCapabilities {
  pickImageFile(): Promise<PickedFile | null>;
  saveImage(request: SaveImageRequest): Promise<SaveImageResult>;
  copyImageToClipboard(data: Uint8Array, mimeType: "image/png"): Promise<void>;
}
```

`getPlatform()` in `src/platform/index.ts` composes the implementations below; it's the only
place that decides which backs the interface.

## Today's implementations

Two capabilities are plain web-platform behavior (`src/platform/web.ts`) and need **no
shell-specific code at all**, so they work unchanged in a plain browser tab (which is exactly
what the E2E suite exploits) as well as in the Tauri webview:

- `pickImageFile` — a hidden `<input type="file" accept="image/*">`. The webview already opens
  the real native OS file dialog (Finder/Explorer/GTK picker) for this.
- `copyImageToClipboard` — the standard Async Clipboard API
  (`navigator.clipboard.write([new ClipboardItem(...)])`).

One capability genuinely needs the shell (`src/platform/tauri.ts`), because a webview has no
filesystem access of its own:

- `saveImage` — a native "Save As" dialog + disk write. `save()` from
  `@tauri-apps/plugin-dialog` returns the chosen path (or `null` on cancel), then `writeFile()`
  from `@tauri-apps/plugin-fs` writes the bytes. Both plugins are registered in
  `src-tauri/src/lib.rs`, and both are gated by `src-tauri/capabilities/default.json` — note
  `fs:allow-write-file` carries a **path scope**: a write outside it fails at runtime even
  though the dialog happily returned the path. The scope lists the user directories a save
  dialog can realistically land in.

`getPlatform()` returns `{ ...webPlatform, ...tauriPlatform }`.

## Outside the interface

Two shell touchpoints are deliberately *not* `PlatformCapabilities` members, because no Image
Creator code calls them:

- `src/platform/host.ts` — `IS_MAC`, from the os plugin's `platform()`. It gates cosmetic
  window chrome (the traffic-light spacer in `components/TitleBar/TitleBar.tsx` and
  `features/image-creator/components/CreatorTopBar.tsx`). `platform()` reads
  `window.__TAURI_OS_PLUGIN_INTERNALS__` synchronously and throws outside a Tauri shell, so
  `host.ts` catches that and falls back to "not macOS" — this module is evaluated at import
  time, and a throw here would take the whole app down in the browser-based E2E run.
- `src/lib/externalLinks.ts` — one delegated click listener that hands outbound `https:` links
  to `openUrl()` instead of letting the webview navigate away. See docs/unsplash.md; it lives
  in `lib/` because it's a document-level listener, not a capability anything calls.

The AI assistant (`src/lib/ai.ts`) is a third: it uses Tauri's HTTP plugin as the `fetch`
implementation handed to `createAnthropic`, because `api.anthropic.com` refuses cross-origin
requests and the plugin issues the call from Rust, past the webview's CORS preflight. Note that
this is necessary but *not* sufficient — the plugin forces its own `Origin` header on every
request, so Anthropic still sees a browser-shaped call and `ai.ts` must also send
`anthropic-dangerous-direct-browser-access: true`. BibleQL and Unsplash both send `access-control-allow-origin: *`, so they use plain
`fetch` and must keep doing so — routing them through the plugin would buy nothing and would
break the E2E suite, which mocks them at the network layer.

## Deliberately not here yet

Revealing a file in Finder/Explorer after saving it (the opener plugin's `revealItemInDir` would
cover this), and the three social "Share" buttons (spec §16) are not implemented — direct
posting to Facebook/X/Instagram needs a registered developer app + OAuth credentials for each
platform, which this project doesn't have. If that's revisited, the realistic ceiling without
those credentials is a browser share-intent URL (opened via `openUrl`) with the verse reference
pre-filled as text — the user still has to attach the already-saved image manually, since none
of those URLs accept image bytes.

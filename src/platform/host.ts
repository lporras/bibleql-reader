import { platform } from "@tauri-apps/plugin-os";

// Replaces Electron's `window.desktop.platform` (exposed by the old
// preload's contextBridge).
//
// ⚠️ The os plugin returns "macos" — NOT Node's "darwin", which is what
// `window.desktop.platform` used to return and what the call sites used
// to compare against.
//
// `platform()` is a synchronous read of `window.__TAURI_OS_PLUGIN_INTERNALS__`,
// which only the Tauri shell injects, so it throws outside one. This is
// evaluated at module scope and gates nothing but cosmetic macOS window
// chrome, so a failure must not take the whole app down with it — the
// E2E suite drives this same bundle in a plain browser. Fall back to
// "not macOS", which is the layout that assumes ordinary OS decorations.
function detectIsMac(): boolean {
  try {
    return platform() === "macos";
  } catch {
    return false;
  }
}

export const IS_MAC = detectIsMac();

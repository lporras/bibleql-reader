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

declare global {
  interface Window {
    // Injected by the Android shell (MainActivity.kt, SystemBars). Absent on
    // desktop and in the browser E2E run.
    AndroidSystemBars?: { setColors(color: string, dark: boolean): void };
  }
}

// Android draws the app edge-to-edge, and the strips behind the status and
// navigation bars would otherwise follow the *system* theme rather than the
// app's own light/dark toggle. Paints them in the page's current `--surface`
// (read back after `data-theme` has been applied, so the palette stays defined
// in one place) and flips the bars' icons to contrast. A no-op everywhere else.
export function syncSystemBars(dark: boolean): void {
  const bars = window.AndroidSystemBars;
  if (!bars) return;
  const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  if (surface) bars.setColors(surface, dark);
}

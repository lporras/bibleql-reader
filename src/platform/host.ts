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
// evaluated at module scope, so a failure must not take the whole app down
// with it — the E2E suite drives this same bundle in a plain browser. Fall
// back to "neither", which is the desktop layout with ordinary OS decorations
// and the desktop save dialog.
function detectPlatform(): string | null {
  try {
    return platform();
  } catch {
    return null;
  }
}

const PLATFORM = detectPlatform();

export const IS_MAC = PLATFORM === "macos";

// iPadOS reports "ios" too. Gates the share-sheet export in platform/tauri.ts.
export const IS_IOS = PLATFORM === "ios";

export type RegistrationPlatform = "MACOS" | "WINDOWS" | "LINUX" | "IOS" | "ANDROID";

const REGISTRATION_PLATFORMS: Record<string, RegistrationPlatform> = {
  macos: "MACOS",
  windows: "WINDOWS",
  linux: "LINUX",
  ios: "IOS",
  android: "ANDROID"
};

// BibleQL's `Platform` enum, for `registerInstallation`. In a browser there
// is no os plugin to ask, so the user agent's best guess stands in.
function guessFromUserAgent(): RegistrationPlatform {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Mac/i.test(ua)) return "MACOS";
  if (/Win/i.test(ua)) return "WINDOWS";
  return "LINUX";
}

export const REGISTRATION_PLATFORM: RegistrationPlatform =
  (PLATFORM && REGISTRATION_PLATFORMS[PLATFORM]) || guessFromUserAgent();

declare global {
  interface Window {
    // Injected by the Android shell (MainActivity.kt, SystemBars). Absent on
    // desktop and in the browser E2E run.
    AndroidSystemBars?: { setColors(color: string, dark: boolean): void };
    // Injected by the Android shell (MainActivity.kt, Tts): the platform
    // TextToSpeech, because Android WebView's speechSynthesis is a silent
    // stub. `textsJson` is a JSON string array, one utterance per item.
    // Progress comes back through `__androidTtsEvent`, which src/lib/speech.ts
    // installs. Absent on desktop and in the browser E2E run.
    AndroidTts?: { speak(textsJson: string, lang: string, run: number): void; stop(): void };
    __androidTtsEvent?: (type: "start" | "end", run: number, index: number) => void;
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

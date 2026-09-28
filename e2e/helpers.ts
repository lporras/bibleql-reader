import { expect, type Page } from "@playwright/test";

/**
 * A recorded `window.__TAURI_INTERNALS__.invoke` call. The Tauri shell
 * injects that object into the webview; under this suite the app runs in
 * a plain Chromium page, so the stub below stands in for it.
 */
export interface TauriCall {
  cmd: string;
  args: Record<string, unknown>;
}

declare global {
  interface Window {
    __TAURI_CALLS__: TauriCall[];
  }
}

/**
 * Installs a stub Tauri runtime before any app code runs.
 *
 * Under Electron these specs launched the real packaged binary, so the
 * shell was genuinely there. A browser has no shell, and every Tauri API
 * the app uses bottoms out in `window.__TAURI_INTERNALS__.invoke` (the
 * opener, dialog and fs plugins) or in
 * `window.__TAURI_OS_PLUGIN_INTERNALS__` (the os plugin's sync
 * `platform()`). Without these the app throws on boot.
 *
 * Recording the calls is the point, not just silencing them: it turns
 * "did this open in the system browser rather than navigating the app"
 * into a direct assertion on the command and URL handed to the shell —
 * the same thing the old suite got by stubbing `shell.openExternal` in
 * Electron's main process.
 */
async function installTauriStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__TAURI_CALLS__ = [];

    // The os plugin reads these synchronously as plain properties.
    // "linux" keeps the non-macOS layout (a normal OS title bar), which
    // is what a browser page should look like.
    (window as unknown as { __TAURI_OS_PLUGIN_INTERNALS__: unknown }).__TAURI_OS_PLUGIN_INTERNALS__ = {
      platform: "linux",
      eol: "\n",
      version: "0.0.0",
      family: "unix",
      arch: "x86_64",
      exe_extension: ""
    };

    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
        window.__TAURI_CALLS__.push({ cmd, args });
        // `plugin:dialog|save` returning null reads as "user cancelled",
        // which keeps the export flow from trying to write a file.
        if (cmd === "plugin:dialog|save") return null;
        return null;
      },
      transformCallback: (cb: unknown) => cb,
      unregisterCallback: () => {},
      convertFileSrc: (p: string) => p
    };
  });
}

export interface App {
  page: Page;
}

/**
 * Opens the app at its default route in a fresh page.
 *
 * The Electron version of this created a throwaway `--user-data-dir` per
 * launch, because every launch on a machine otherwise shared one real
 * profile and a test's outcome depended on whatever theme/compare/
 * translation state was last left there. Playwright already gives each
 * test its own browser context — and therefore its own empty
 * `localStorage` — so that isolation now comes for free, and there is no
 * profile directory to clean up afterwards.
 */
export async function launchApp(page: Page): Promise<App> {
  await installTauriStub(page);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  return { page };
}

/** Navigates the (already-loaded) app to a hash route and waits for it to settle. */
export async function goTo(page: Page, hashRoute: string): Promise<void> {
  await page.evaluate((route) => {
    window.location.hash = route;
  }, hashRoute);
}

/** Every Tauri command the page has invoked so far, in order. */
export function tauriCalls(page: Page): Promise<TauriCall[]> {
  return page.evaluate(() => window.__TAURI_CALLS__);
}

/** Waits until a command has been invoked, then returns every call to it. */
export async function waitForTauriCalls(page: Page, cmd: string): Promise<TauriCall[]> {
  await expect
    .poll(async () => (await tauriCalls(page)).filter((call) => call.cmd === cmd).length)
    .toBeGreaterThan(0);
  return (await tauriCalls(page)).filter((call) => call.cmd === cmd);
}

/** Matches either locale's label for a button — this app ships en/es strings. */
export function labelPattern(en: string, es: string): RegExp {
  return new RegExp(`${en}|${es}`, "i");
}

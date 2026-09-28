import path from "node:path";
import fs from "node:fs";
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

interface BibleQLFixture {
  translations: unknown[];
  passages: Record<string, unknown>;
}

const BIBLEQL: BibleQLFixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures/bibleql.json"), "utf8")
);

/**
 * Answers every BibleQL request from `fixtures/bibleql.json` instead of the
 * live API. Specs never hit a real service (see CLAUDE.md), and that also
 * means the suite doesn't need a real BIBLEQL_API_KEY. A fork's PR gets no
 * repo secrets on CI, which used to leave the app on its no-key sample
 * chapter, so every spec timed out waiting for John 3.
 *
 * Passages are keyed "<translation>|<reference>", matching the variables
 * usePassage sends. Anything the fixture lacks comes back as a GraphQL
 * error. It surfaces in the UI and in the failing spec, rather than quietly
 * falling through to the network.
 */
async function mockBibleQL(page: Page): Promise<void> {
  await page.route("https://bibleql.org/graphql", (route) => {
    const { query, variables = {} } = route.request().postDataJSON() as {
      query: string;
      variables?: Record<string, string>;
    };

    if (query.includes("passage(")) {
      const passage = BIBLEQL.passages[`${variables.t}|${variables.r}`];
      if (passage) return route.fulfill({ json: { data: { passage } } });
    } else if (query.includes("translations")) {
      return route.fulfill({ json: { data: { translations: BIBLEQL.translations } } });
    } else if (query.includes("translation(")) {
      const translation = (BIBLEQL.translations as { identifier: string }[]).find((t) => t.identifier === variables.i);
      return route.fulfill({ json: { data: { translation: translation ?? null } } });
    }

    return route.fulfill({
      json: { errors: [{ message: `e2e: no BibleQL fixture for ${JSON.stringify({ query, variables })}` }] }
    });
  });
}

export interface App {
  page: Page;
}

/**
 * Opens the app in a fresh page — at its default route, or straight at
 * `hashRoute` (e.g. "#/read/JHN/3/ai"). Going straight there skips
 * RootRedirect entirely, so there's no pending navigation to race and no
 * throwaway Psalm 23 fetch before the chapter the spec actually wants.
 *
 * The Electron version of this created a throwaway `--user-data-dir` per
 * launch, because every launch on a machine otherwise shared one real
 * profile and a test's outcome depended on whatever theme/compare/
 * translation state was last left there. Playwright already gives each
 * test its own browser context — and therefore its own empty
 * `localStorage` — so that isolation now comes for free, and there is no
 * profile directory to clean up afterwards.
 */
export async function launchApp(page: Page, hashRoute = ""): Promise<App> {
  await installTauriStub(page);
  await mockBibleQL(page);
  await page.goto(`/${hashRoute}`);
  await page.waitForLoadState("domcontentloaded");
  return { page };
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

import { test, expect, type Page } from "@playwright/test";
import { launchApp, labelPattern } from "./helpers";

interface TtsCall {
  method: "speak" | "stop";
  texts?: string[];
  lang?: string;
  run?: number;
}

// Mirrors the declarations in src/platform/host.ts, which this tsconfig
// project doesn't include.
declare global {
  interface Window {
    __TTS_CALLS__: TtsCall[];
    AndroidTts?: { speak(textsJson: string, lang: string, run: number): void; stop(): void };
    __androidTtsEvent?: (type: "start" | "end", run: number, index: number) => void;
  }
}

/**
 * Android WebView's `speechSynthesis` never speaks, so on Android the shell
 * injects `window.AndroidTts` (MainActivity.kt) and src/lib/speech.ts routes
 * read-aloud through it. This stub stands in for that bridge and records
 * what the page asks it to say; progress is fed back by calling
 * `window.__androidTtsEvent` from the spec, the way the shell does.
 */
async function installAndroidTtsStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__TTS_CALLS__ = [];
    window.AndroidTts = {
      speak: (textsJson, lang, run) => {
        window.__TTS_CALLS__.push({ method: "speak", texts: JSON.parse(textsJson), lang, run });
      },
      stop: () => {
        window.__TTS_CALLS__.push({ method: "stop" });
      }
    };
  });
}

function ttsCalls(page: Page): Promise<TtsCall[]> {
  return page.evaluate(() => window.__TTS_CALLS__);
}

async function lastSpeak(page: Page): Promise<TtsCall> {
  await expect.poll(async () => (await ttsCalls(page)).some((call) => call.method === "speak")).toBe(true);
  return (await ttsCalls(page)).filter((call) => call.method === "speak").at(-1)!;
}

function emit(page: Page, type: "start" | "end", run: number, index = -1): Promise<void> {
  return page.evaluate(([t, r, i]) => window.__androidTtsEvent?.(t as "start" | "end", r as number, i as number), [
    type,
    run,
    index
  ] as const);
}

test.describe("Read-aloud on Android", () => {
  test.beforeEach(async ({ page }) => {
    await installAndroidTtsStub(page);
    await launchApp(page, "#/read/JHN/3/ai");
    await page.waitForSelector('p[data-verse="16"]');
  });

  const listenButton = (page: Page) =>
    page.getByRole("button", { name: labelPattern("Listen to chapter", "Escuchar capítulo") });
  const stopButton = (page: Page) => page.getByRole("button", { name: labelPattern("^Stop$", "^Detener$") });

  test("reading the chapter goes through the native bridge and highlights the current verse", async ({ page }) => {
    await listenButton(page).click();

    const call = await lastSpeak(page);
    expect(call.lang).toBe("en-US");
    const verse16 = page.locator('p[data-verse="16"]').first();
    // Compare is off by default, so there's a single column of verses.
    expect(call.texts).toHaveLength(await page.locator("p[data-verse]").count());
    expect(await verse16.textContent()).toContain(call.texts![15]);

    await emit(page, "start", call.run!, 15);
    await expect(verse16).toHaveClass(/speaking/);

    await emit(page, "end", call.run!);
    await expect(listenButton(page)).toBeVisible();
    await expect(page.locator("p[data-verse][class*='speaking']")).toHaveCount(0);
  });

  test("events from a stopped run are ignored", async ({ page }) => {
    await listenButton(page).click();
    const call = await lastSpeak(page);

    await stopButton(page).click();
    await expect.poll(async () => (await ttsCalls(page)).some((c) => c.method === "stop")).toBe(true);
    await expect(listenButton(page)).toBeVisible();

    // The shell may still report progress for the queue it was stopping.
    await emit(page, "start", call.run!, 2);
    await expect(page.locator('p[data-verse="3"]').first()).not.toHaveClass(/speaking/);
    await expect(listenButton(page)).toBeVisible();
  });

  test("listening to one verse sends just that verse", async ({ page }) => {
    await page.getByRole("button", { name: labelPattern("Listen to verse 16$", "Escuchar versículo 16$") }).first().click();

    const call = await lastSpeak(page);
    expect(call.texts).toHaveLength(1);
    expect(await page.locator('p[data-verse="16"]').first().textContent()).toContain(call.texts![0]);
  });
});

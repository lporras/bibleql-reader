import { test, expect } from "@playwright/test";
import { launchApp, goTo, waitForTauriCalls } from "./helpers";

// Requires the dev server to have started with a real BIBLEQL_API_KEY
// (see `yarn test:e2e` / CI) — verse selection hands off real passage data
// fetched by the editor, which the app's own no-key sample fallback
// doesn't cover (that fallback only feeds the Reader, not the editor's
// re-fetch). Locally this works via .env.local; in CI the workflow
// passes the same repo secret release builds already use.
test.describe("Image Creator", () => {
  test.beforeEach(async ({ page }) => {
    await launchApp(page);

    // Wait for the default route to actually mount before touching the
    // hash ourselves — changing it too early can race RootRedirect's own
    // pending navigation.
    await page.waitForSelector("[data-verse]");
    await goTo(page, "#/read/JHN/3/ai");
    await page.waitForSelector('p[data-verse="16"]');

    // Click verse 16, shift-click verse 17 to extend the range — no
    // checkbox, per this app's selection UI (see VerseList.tsx). .first():
    // only the primary column is ever selectable, but both would match
    // if "Compare" happened to be on.
    await page.locator('p[data-verse="16"]').first().click({ position: { x: 20, y: 10 } });
    await page.locator('p[data-verse="17"]').first().click({ modifiers: ["Shift"], position: { x: 20, y: 10 } });

    await page.getByRole("button", { name: /Create Image|Crear imagen/i }).click();
    await page.waitForSelector('[role="textbox"]');
  });

  test("hands off the selected verses as scripture + reference elements", async ({ page }) => {
    const textBoxes = page.locator('[role="textbox"]');
    await expect(textBoxes).toHaveCount(2);

    const reference = textBoxes.filter({ hasText: /\d+:\d/ });
    await expect(reference).toContainText("3:16");

    const scripture = textBoxes.filter({ hasNotText: /^\D*\d+:\d/ });
    await expect(scripture).toContainText("God so loved the world");
  });

  test("every curated thumbnail carries a working photographer link", async ({ page }) => {
    // Unsplash's guidelines require the photographer credited and linked
    // to their *profile*. An earlier version derived the handle from the
    // download filename slug, and all six links 404'd — this asserts the
    // verified handle instead (see data/curatedImages.ts).
    await page.locator("img[src*='bible-images/thumb/']").first().waitFor();

    const credit = page.getByRole("link", { name: "Aaron Burden" }).first();
    await expect(credit).toBeVisible();
    await expect(credit).toHaveAttribute("href", /^https:\/\/unsplash\.com\/@aaronburden\?/);
    await expect(credit).toHaveAttribute("href", /utm_source=bibleql-reader/);
    await expect(credit).toHaveAttribute("href", /utm_medium=referral/);
  });

  test("selecting a curated background applies it with attribution", async ({ page }) => {
    // "Curated" is the default Background tab — no tab click needed.
    const thumb = page.locator("img[src*='bible-images/thumb/']").first();
    await thumb.waitFor();
    await thumb.click();

    await expect(page.locator("img[src*='bible-images/full/']")).toBeVisible();
    // Scoped: every curated thumbnail now shows its own "on Unsplash"
    // link too, so an unscoped lookup matches many nodes and trips
    // Playwright's strict mode.
    const selected = page.getByTestId("selected-attribution");
    await expect(selected.getByRole("link", { name: "Unsplash" })).toBeVisible();
    await expect(selected).toContainText("Aaron Burden");
  });

  test("attribution links open in the system browser, not an in-app window", async ({ page }) => {
    // A webview would otherwise navigate the app itself away to
    // unsplash.com, leaving the user in a chromeless view with no way
    // back. src/lib/externalLinks.ts intercepts the click and hands the
    // URL to the OS instead (see docs/unsplash.md).
    //
    // Under Electron this was asserted by stubbing `shell.openExternal`
    // in the main process. The Tauri equivalent is the recorded
    // `plugin:opener|open_url` command (see e2e/helpers.ts) — still a
    // direct assertion on the URL handed to the shell, rather than an
    // inference from the absence of a window.
    await page.locator("img[src*='bible-images/thumb/']").first().waitFor();

    const urlBefore = page.url();
    await page.getByRole("link", { name: "Aaron Burden" }).first().click();

    const calls = await waitForTauriCalls(page, "plugin:opener|open_url");
    expect(calls).toHaveLength(1);

    const opened = calls[0].args.url as string;
    expect(opened).toMatch(/^https:\/\/unsplash\.com\/@aaronburden\?/);
    expect(opened).toContain("utm_source=bibleql-reader");

    // The app itself must not have navigated anywhere.
    expect(page.url()).toBe(urlBefore);
  });

  test("double-clicking the scripture text enters edit mode and commits a shortened version", async ({ page }) => {
    const scripture = page.locator('[role="textbox"]').filter({ hasNotText: /^\D*\d+:\d/ });

    await scripture.dblclick();
    await expect(scripture).toHaveAttribute("contenteditable", "true");

    // Entering edit mode selects the existing text, so Backspace clears
    // it before typing the replacement.
    await page.keyboard.press("Backspace");
    await page.keyboard.type("Shortened version.");
    await page.keyboard.press("Escape");

    await expect(scripture).toHaveAttribute("contenteditable", "false");
    await expect(scripture).toHaveText("Shortened version.");
  });

  test("copying the image places real PNG bytes on the clipboard", async ({ page }) => {
    await page.getByRole("button", { name: /Copy Image|Copiar imagen/i }).click();
    await expect(page.getByText(/Copied|Copiado/i)).toBeVisible({ timeout: 10_000 });

    const clipboardHasPng = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      return items.some((item) => item.types.includes("image/png"));
    });
    expect(clipboardHasPng).toBe(true);
  });
});

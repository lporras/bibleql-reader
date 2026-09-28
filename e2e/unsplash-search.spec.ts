import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { launchApp, goTo } from "./helpers";

// Mocked entirely — this app's specs must never hit a real external API
// (BibleQL, Unsplash) — see docs/unsplash.md and CLAUDE.md's testing
// section. `images.unsplash.com` (the actual photo bytes, once a result
// is selected) is left un-mocked and hits the real CDN: per Unsplash's
// own docs those requests don't count against the API rate limit, only
// requests to api.unsplash.com do, which is everything mocked here.
const FIXTURE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/unsplash-search.json"), "utf8"));

test.describe("Unsplash search", () => {
  let downloadTriggered = false;
  let downloadUrl = "";
  let downloadAuth: string | undefined;

  test.beforeEach(async ({ page }) => {
    await launchApp(page);
    downloadTriggered = false;
    downloadUrl = "";
    downloadAuth = undefined;

    await page.route("https://api.unsplash.com/search/photos**", (route) => route.fulfill({ json: FIXTURE }));
    await page.route("https://api.unsplash.com/photos/*/download**", (route) => {
      downloadTriggered = true;
      downloadUrl = route.request().url();
      downloadAuth = route.request().headers()["authorization"];
      return route.fulfill({ json: { url: "https://images.unsplash.com/mock-download" } });
    });

    await page.waitForSelector("[data-verse]");
    await goTo(page, "#/read/JHN/3/ai");
    await page.waitForSelector('p[data-verse="16"]');
    await page.locator('p[data-verse="16"]').first().click({ position: { x: 20, y: 10 } });
    await page.getByRole("button", { name: /Create Image|Crear imagen/i }).click();
    await page.waitForSelector('[role="textbox"]');

    // "Curated" is the default Background tab — switch to "Search".
    await page.getByRole("tab", { name: /Search|Buscar/i }).click();

    // Fail fast with a clear message here rather than a confusing 30s
    // timeout in the first real assertion: the Search tab only renders
    // the search box when UNSPLASH_ACCESS_KEY was non-empty at build
    // time (see BackgroundPanel.tsx) — otherwise it shows the "offline"
    // fallback text instead. A missing/misnamed/wrong-scope CI secret
    // shows up here as this exact failure.
    const hasSearchBox = await page
      .getByRole("searchbox")
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!hasSearchBox) {
      throw new Error(
        "The Search tab isn't showing a search box — UNSPLASH_ACCESS_KEY was probably empty at build time " +
          "(check the 'Verify required secrets are present' CI step, or your local .env.local)."
      );
    }
  });

  test("searching shows results from the (mocked) API", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");

    // Debounced (see hooks/useDebouncedValue.ts) — the grid should
    // settle on exactly the two mocked results.
    const thumbs = page.locator("img[src*='images.unsplash.com']");
    await expect(thumbs).toHaveCount(2, { timeout: 5000 });
  });

  test("selecting a result applies it as the background, with attribution, and pings the download endpoint", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");

    const firstThumb = page.locator("img[src*='images.unsplash.com']").first();
    await firstThumb.waitFor();
    await firstThumb.click();

    // Scoped: each search result now carries its own credit links, so an
    // unscoped lookup matches several nodes and trips strict mode.
    const selected = page.getByTestId("selected-attribution");
    await expect(selected).toContainText("Kalen Emsley");
    await expect(selected.getByRole("link", { name: "Unsplash" })).toBeVisible();

    await expect.poll(() => downloadTriggered).toBe(true);
    // The guideline requires pinging the API's own `links.download_location`,
    // whose signed ixid ties the event to the originating search. A
    // hand-built `/photos/:id/download` cannot produce this.
    expect(downloadUrl).toContain("ixid=mock-ixid-1");
    // The ping is a plain fetch rather than an SDK call, so it has to
    // carry auth itself.
    expect(downloadAuth).toMatch(/^Client-ID /);
  });

  test("every search result shows a linked photographer credit", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");
    await page.locator("img[src*='images.unsplash.com']").first().waitFor();

    const credit = page.getByRole("link", { name: "Kalen Emsley" }).first();
    await expect(credit).toBeVisible();
    await expect(credit).toHaveAttribute("href", /^https:\/\/unsplash\.com\/@kalenemsley\?/);
    await expect(credit).toHaveAttribute("href", /utm_source=bibleql-reader/);
    await expect(credit).toHaveAttribute("href", /utm_medium=referral/);
  });

  test("does not trigger the download ping just from displaying search results", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");
    await page.locator("img[src*='images.unsplash.com']").first().waitFor();

    expect(downloadTriggered).toBe(false);
  });

  test("starting a new search fully replaces the results grid, not just its images", async ({ page }) => {
    // Baseline sanity check: the grid container itself is torn down
    // between two distinct searches, not reused. (This holds even
    // without UnsplashSearch.tsx's `key={debouncedQuery}` — the
    // surrounding `results.length > 0` gate already unmounts the whole
    // grid while a new query has no data yet. The more meaningful
    // regression test is the one below, which needs real in-flight
    // timing to say anything.)
    const searchBox = page.getByRole("searchbox");

    await searchBox.fill("mountains");
    await page.locator("img[src*='images.unsplash.com']").first().waitFor();
    const firstGridHandle = await page.evaluateHandle(() => document.querySelector("img[src*='images.unsplash.com']")!.closest("div"));

    await searchBox.fill("");
    await searchBox.fill("ocean");
    await page.locator("img[src*='images.unsplash.com']").first().waitFor();
    await new Promise((r) => setTimeout(r, 500));

    const firstGridStillAttached = await firstGridHandle.evaluate((el) => document.contains(el));
    expect(firstGridStillAttached).toBe(false);
  });

  test("a slow in-flight 'Load More' page doesn't bleed into a search started right after", async ({ page }) => {
    // Matches the reported repro exactly: search, select a result,
    // scroll to the bottom (right where "Load More" sits — easy to hit
    // while scrolling), then search again before that page finishes
    // loading. Unlike the fixture-wide mock above, this route
    // distinguishes page 1 vs. page 2 vs. a different term, and delays
    // page 2 so there's a real window for a race to land in.
    await page.unroute("https://api.unsplash.com/search/photos**");

    const page1 = { total: 4, total_pages: 2, results: FIXTURE.results };
    const page2Photo = { ...FIXTURE.results[0], id: "page2-photo", urls: { ...FIXTURE.results[0].urls, thumb: "https://images.unsplash.com/page2-photo?w=200" } };
    const page2 = { total: 4, total_pages: 2, results: [page2Photo] };
    const oceanPhoto = { ...FIXTURE.results[1], id: "ocean-photo", urls: { ...FIXTURE.results[1].urls, thumb: "https://images.unsplash.com/ocean-photo?w=200" } };
    const oceanPage1 = { total: 1, total_pages: 1, results: [oceanPhoto] };

    await page.route("https://api.unsplash.com/search/photos**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("query");
      const pageParam = url.searchParams.get("page");
      if (query === "mountains" && pageParam === "2") {
        await new Promise((r) => setTimeout(r, 1200)); // still in flight when the next search fires
        return route.fulfill({ json: page2 });
      }
      if (query === "ocean") return route.fulfill({ json: oceanPage1 });
      return route.fulfill({ json: page1 });
    });

    const searchBox = page.getByRole("searchbox");
    await searchBox.fill("mountains");
    await page.locator("img[src*='images.unsplash.com']").first().waitFor();

    await page.getByRole("button", { name: /Load more|Cargar más/i }).click(); // fires the slow page 2 — not awaited

    await searchBox.fill("");
    await searchBox.fill("ocean");
    await page.waitForSelector(`img[src*='ocean-photo']`, { timeout: 5000 });

    // Give the slow page-2 response time to land in the background.
    await new Promise((r) => setTimeout(r, 1500));

    // Strict: the grid should show exactly "ocean"'s one result — no
    // trace of "mountains" page 1 or the slow, late-arriving page 2.
    const thumbSrcs = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>("img[src*='images.unsplash.com']")].map((i) => i.src)
    );
    expect(thumbSrcs).toEqual(["https://images.unsplash.com/ocean-photo?w=200"]);
    expect(await searchBox.inputValue()).toBe("ocean");
  });
});

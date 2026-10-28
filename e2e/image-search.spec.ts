import { test, expect, type Page } from "@playwright/test";
import { BACKGROUND_IMAGES, E2E_TOKEN, bibleqlRequests, launchApp } from "./helpers";

// Background search goes through BibleQL's `backgroundImages` (the server
// holds the Unsplash key and calls Unsplash itself), which launchApp's mock
// answers from fixtures/background-images.json. The app must never call
// api.unsplash.com directly any more; every test checks that.
// `images.unsplash.com` (the actual photo bytes, hotlinked from Unsplash's
// CDN) is left un-mocked: those requests don't count against any API quota.

const searchesFor = (page: Page) => bibleqlRequests(page).filter((r) => r.query.includes("backgroundImages"));
const trackingFor = (page: Page) => bibleqlRequests(page).filter((r) => r.query.includes("trackImageDownload"));

test.describe("Background image search", () => {
  let unsplashApiCalls: string[] = [];

  test.beforeEach(async ({ page }) => {
    unsplashApiCalls = [];
    await page.route("https://api.unsplash.com/**", (route) => {
      unsplashApiCalls.push(route.request().url());
      return route.abort();
    });

    await launchApp(page, "#/read/JHN/3/ai");
    await page.waitForSelector('p[data-verse="16"]');
    await page.locator('p[data-verse="16"]').first().click({ position: { x: 20, y: 10 } });
    await page.getByRole("button", { name: /Create Image|Crear imagen/i }).click();
    await page.waitForSelector('[role="textbox"]');

    // "Curated" is the default Background tab — switch to "Search".
    await page.getByRole("tab", { name: /Search|Buscar/i }).click();
    await page.getByRole("searchbox").waitFor();
  });

  test.afterEach(() => {
    expect(unsplashApiCalls).toEqual([]);
  });

  test("searching asks BibleQL, with the installation token, and shows its results", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");

    // Debounced (see hooks/useDebouncedValue.ts) — the grid should
    // settle on exactly the two mocked results.
    const thumbs = page.locator("img[src*='images.unsplash.com']");
    await expect(thumbs).toHaveCount(2, { timeout: 5000 });

    const [search] = searchesFor(page);
    expect(search.variables).toMatchObject({ q: "mountains", p: 1, n: 24 });
    expect(search.authorization).toBe(`Bearer ${E2E_TOKEN}`);
  });

  test("selecting a result applies it as the background, with attribution, and tracks the download", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");

    const firstThumb = page.locator("img[src*='images.unsplash.com']").first();
    await firstThumb.waitFor();
    await firstThumb.click();

    // Scoped: each search result now carries its own credit links, so an
    // unscoped lookup matches several nodes and trips strict mode.
    const selected = page.getByTestId("selected-attribution");
    await expect(selected).toContainText("Kalen Emsley");
    await expect(selected.getByRole("link", { name: "Unsplash" })).toBeVisible();

    // The server pings Unsplash's download_location for this photo; the app
    // only names it.
    await expect.poll(() => trackingFor(page).length).toBe(1);
    expect(trackingFor(page)[0].variables).toEqual({ id: "Bkci_8qcdvQ" });
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

  test("does not track a download just from displaying search results", async ({ page }) => {
    await page.getByRole("searchbox").fill("mountains");
    await page.locator("img[src*='images.unsplash.com']").first().waitFor();

    expect(trackingFor(page)).toEqual([]);
  });

  test("says so when the server reports Unsplash's rate limit", async ({ page }) => {
    // Registered after launchApp's mock, so it sees BibleQL requests first.
    await page.route("https://bibleql.org/graphql", (route) => {
      if (!(route.request().postData() ?? "").includes("backgroundImages")) return route.fallback();
      return route.fulfill({
        json: { data: { backgroundImages: { images: [], page: 1, totalPages: 0, hasMore: false, errorCode: "RATE_LIMITED" } } }
      });
    });

    await page.getByRole("searchbox").fill("mountains");
    await expect(page.getByText(/Too many image searches|Demasiadas búsquedas/)).toBeVisible();
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
    // loading. Unlike the fixture-wide mock, this route distinguishes
    // page 1 vs. page 2 vs. a different term, and delays page 2 so
    // there's a real window for a race to land in.
    const [mountain, desert] = BACKGROUND_IMAGES.images;
    const withThumb = (image: typeof mountain, id: string) => ({
      ...image,
      id,
      urls: { ...image.urls, thumb: `https://images.unsplash.com/${id}?w=200` }
    });
    const result = (images: unknown[], page: number, totalPages: number) => ({
      data: { backgroundImages: { images, page, totalPages, hasMore: page < totalPages, errorCode: null } }
    });

    await page.route("https://bibleql.org/graphql", async (route) => {
      const body = route.request().postDataJSON() as { query: string; variables: { q: string; p: number } };
      if (!body.query.includes("backgroundImages")) return route.fallback();
      const { q, p } = body.variables;
      if (q === "mountains" && p === 2) {
        await new Promise((r) => setTimeout(r, 1200)); // still in flight when the next search fires
        return route.fulfill({ json: result([withThumb(mountain, "page2-photo")], 2, 2) });
      }
      if (q === "ocean") return route.fulfill({ json: result([withThumb(desert, "ocean-photo")], 1, 1) });
      return route.fulfill({ json: result([mountain, desert], 1, 2) });
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

import { test, expect, type Page } from "@playwright/test";
import { launchApp, tauriCalls, waitForTauriCalls, labelPattern } from "./helpers";

// Offline translations. The download, verification and SQLite queries live
// in Rust (src-tauri/src/offline.rs, covered by `cargo test`); these specs
// drive the frontend half against canned offline_* command results: the
// download control, and that an installed translation is read through the
// shell instead of BibleQL.

const INSTALLED_WEB = {
  identifier: "eng-web",
  name: "World English Bible",
  abbrev: "WEB",
  languageCode: "eng",
  languageName: "English",
  licenseNote: "Public Domain",
  exportedAt: "2026-10-01T02:29:13Z",
  verseCount: 31098,
  sha256: "e2e0000000000000000000000000000000000000000000000000000000000000",
  schemaVersion: 1,
  sizeBytes: 3404184,
  installedAt: 0
};

const OFFLINE_JOHN_3 = {
  reference: "John 3",
  translationName: "World English Bible",
  translationNote: "Public Domain",
  verses: [{ verse: 16, text: "Read from the offline package." }]
};

/** Every BibleQL request body that asked for a passage. */
function recordPassageRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://bibleql.org/graphql") && request.postData()?.includes("passage(")) {
      seen.push(request.postData() ?? "");
    }
  });
  return seen;
}

test.describe("Offline translations", () => {
  test("downloads the current translation, then removes it", async ({ page }) => {
    await launchApp(page, "#/read/JHN/3/ai", {
      offline_list: [],
      offline_install: INSTALLED_WEB,
      offline_passage: OFFLINE_JOHN_3
    });
    await page.waitForSelector('p[data-verse="16"]');

    await page.getByRole("button", { name: labelPattern("Download for offline", "Descargar para usar") }).click();

    const [install] = await waitForTauriCalls(page, "offline_install");
    expect(install.args).toMatchObject({
      identifier: "eng-web",
      url: "https://downloads.example.org/translations/eng-web/v1/e2e.sqlite.gz",
      sha256: INSTALLED_WEB.sha256,
      schemaVersion: 1
    });

    const ready = page.getByRole("button", { name: labelPattern("Available offline", "Disponible sin conexión") });
    await expect(ready).toBeVisible();

    // Installing invalidates the translation's queries, so the open
    // chapter is re-read from the package.
    const [passage] = await waitForTauriCalls(page, "offline_passage");
    expect(passage.args).toMatchObject({ identifier: "eng-web", bookCode: "JHN", chapter: 3 });
    await expect(page.locator('p[data-verse="16"]').first()).toContainText("Read from the offline package.");

    await ready.click();
    await page.getByRole("menuitem", { name: labelPattern("Remove download", "Eliminar descarga") }).click();
    const [remove] = await waitForTauriCalls(page, "offline_remove");
    expect(remove.args).toMatchObject({ identifier: "eng-web" });
    await expect(page.getByRole("button", { name: labelPattern("Download for offline", "Descargar para usar") })).toBeVisible();
  });

  test("an installed translation is read locally, never from BibleQL", async ({ page }) => {
    const passageRequests = recordPassageRequests(page);
    await launchApp(page, "#/read/JHN/3/ai", {
      offline_list: [INSTALLED_WEB],
      offline_passage: OFFLINE_JOHN_3
    });

    await expect(page.locator('p[data-verse="16"]').first()).toContainText("Read from the offline package.");
    expect(passageRequests).toEqual([]);
    expect((await tauriCalls(page)).some((call) => call.cmd === "offline_passage")).toBe(true);
  });

  // TanStack Query pauses queries while navigator.onLine is false (its
  // default networkMode "online"). Local reads must ignore that, or with
  // Wi-Fi off the reader keeps showing the previous chapter forever.
  test("with the network down, chapter navigation still reads locally", async ({ page }) => {
    await launchApp(page, "#/read/JHN/3/ai", {
      offline_list: [INSTALLED_WEB],
      offline_passage: OFFLINE_JOHN_3
    });
    await expect(page.locator('p[data-verse="16"]').first()).toContainText("Read from the offline package.");

    await page.context().setOffline(true);
    await page.getByRole("button", { name: labelPattern("Next chapter", "Capítulo siguiente") }).click();

    await expect
      .poll(async () =>
        (await tauriCalls(page)).some((call) => call.cmd === "offline_passage" && call.args.chapter === 4)
      )
      .toBe(true);
  });

  // Search and concordance prefer BibleQL whenever it's reachable, even for
  // a downloaded translation; the local index is for offline (or failure).
  test.describe("search and concordance on a downloaded translation", () => {
    const LOCAL_HIT = [{ bookName: "John", chapter: 3, verse: 16, text: "For God so loved the world (local)" }];
    const SERVER_HIT = [{ bookName: "John", chapter: 3, verse: 17, text: "For God didn't send his Son (server)" }];

    async function openSearch(page: Page, serverSearch: "answers" | "fails"): Promise<string[]> {
      await launchApp(page, "#/read/JHN/3/search", {
        offline_list: [INSTALLED_WEB],
        offline_passage: OFFLINE_JOHN_3,
        offline_search: LOCAL_HIT
      });
      // Registered after launchApp's mock, so it sees BibleQL requests first.
      const searches: string[] = [];
      await page.route("https://bibleql.org/graphql", (route) => {
        const body = route.request().postData() ?? "";
        if (!body.includes("search(")) return route.fallback();
        searches.push(body);
        return serverSearch === "answers"
          ? route.fulfill({ json: { data: { search: SERVER_HIT } } })
          : route.fulfill({ json: { errors: [{ message: "search unavailable" }] } });
      });
      await expect(page.locator('p[data-verse="16"]').first()).toBeVisible();
      return searches;
    }

    async function search(page: Page, text: string): Promise<void> {
      const input = page.getByPlaceholder(labelPattern("Words or phrase", "Palabras o frase"));
      await input.fill(text);
      await input.press("Enter");
    }

    test("online, search asks BibleQL", async ({ page }) => {
      const searches = await openSearch(page, "answers");
      await search(page, "send son");

      await expect(page.getByRole("button", { name: "John 3:17" })).toBeVisible();
      expect(searches).toHaveLength(1);
      expect((await tauriCalls(page)).some((call) => call.cmd === "offline_search")).toBe(false);
    });

    test("offline, search uses the local index", async ({ page }) => {
      const searches = await openSearch(page, "answers");
      await page.context().setOffline(true);
      await search(page, "loved world");

      const [call] = await waitForTauriCalls(page, "offline_search");
      expect(call.args).toMatchObject({ identifier: "eng-web", query: "loved world", limit: 40 });
      await expect(page.getByRole("button", { name: "John 3:16" })).toBeVisible();
      expect(searches).toEqual([]);
      // Plain-text hits get the query's words marked, as concordance does.
      await expect(page.locator('[class*="hitWord"]')).toHaveText(["loved", "world"]);
    });

    test("when BibleQL fails, search falls back to the local index", async ({ page }) => {
      const searches = await openSearch(page, "fails");
      await search(page, "loved world");

      await expect(page.getByRole("button", { name: "John 3:16" })).toBeVisible();
      expect(searches).toHaveLength(1);
    });

    test("offline, concordance pages through the local index", async ({ page }) => {
      const page1 = {
        totalCount: 26,
        entry: { surfaceForms: ["loved"], totalOccurrences: 26, verseCount: 26, occurrencesByTestament: { old: 0, new: 26 } },
        hits: Array.from({ length: 25 }, (_, i) => ({
          context: "God so <mark>loved</mark> the world",
          verse: { bookName: "John", chapter: 3, verse: i + 1 }
        })),
        pageInfo: { hasNextPage: true, endCursor: "26137" }
      };
      await launchApp(page, "#/read/JHN/3/conc", {
        offline_list: [INSTALLED_WEB],
        offline_passage: OFFLINE_JOHN_3,
        offline_concordance: page1
      });
      await expect(page.locator('p[data-verse="16"]').first()).toBeVisible();
      await page.context().setOffline(true);

      const input = page.getByPlaceholder(labelPattern("Word to study", "Palabra a estudiar"));
      await input.fill("loved");
      await input.press("Enter");
      await expect(page.getByRole("button", { name: "John 3:25" })).toBeVisible();

      await page.getByRole("button", { name: labelPattern("Load more", "Cargar más") }).click();
      await expect
        .poll(async () => (await tauriCalls(page)).filter((call) => call.cmd === "offline_concordance").map((c) => c.args.after))
        .toEqual([null, "26137"]);
    });
  });

  test("a translation BibleQL doesn't package shows no download control", async ({ page }) => {
    await launchApp(page, "#/read/JHN/3/ai", { offline_list: [] });
    await page.waitForSelector('p[data-verse="16"]');
    await expect(page.getByRole("button", { name: labelPattern("Download for offline", "Descargar para usar") })).toBeVisible();

    // spa-rv1909 has offlineDownloadable: false in the fixture.
    await page.getByPlaceholder(labelPattern("Type to filter translations", "Escribe para filtrar traducciones")).click();
    await page.getByRole("button", { name: "Reina Valera 1909" }).click();
    await expect(page.getByRole("button", { name: labelPattern("Download for offline", "Descargar para usar") })).toHaveCount(0);
  });
});

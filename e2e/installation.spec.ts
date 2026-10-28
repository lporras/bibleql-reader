import { test, expect, type Page } from "@playwright/test";
import {
  E2E_INSTALLATION_ID,
  E2E_REGISTERED_TOKEN,
  E2E_TOKEN,
  bibleqlRequests,
  labelPattern,
  launchApp,
  prepareApp,
  waitForTauriCalls
} from "./helpers";

// Per-installation keys (docs/installation-keys.md): the first launch
// registers with BibleQL and stores the token through the shell
// (`set_install_token`); a rejected token is replaced once; a failed
// registration leaves the app on its bundled sample. All of it against
// launchApp's mocked BibleQL and the stub shell.

const FIRST_LAUNCH = { get_install_token: { installationId: E2E_INSTALLATION_ID, token: null } };

const registrations = (page: Page) => bibleqlRequests(page).filter((r) => r.query.includes("registerInstallation"));
const passages = (page: Page) => bibleqlRequests(page).filter((r) => r.query.includes("passage("));

test.describe("Installation key", () => {
  test("the first launch registers without a key, stores the token and uses it", async ({ page }) => {
    await launchApp(page, "#/read/JHN/3/ai", FIRST_LAUNCH);
    await expect(page.locator('p[data-verse="16"]').first()).toBeVisible();

    expect(registrations(page)).toHaveLength(1);
    const [registration] = registrations(page);
    expect(registration.authorization).toBeUndefined();
    expect(registration.variables).toMatchObject({ id: E2E_INSTALLATION_ID, p: "LINUX" });
    expect(registration.variables.v).toMatch(/^\d+\.\d+\.\d+/);

    const [stored] = await waitForTauriCalls(page, "set_install_token");
    expect(stored.args).toEqual({ token: E2E_REGISTERED_TOKEN });
    expect(passages(page).every((r) => r.authorization === `Bearer ${E2E_REGISTERED_TOKEN}`)).toBe(true);
  });

  test("a stored token is used as-is, with no registration", async ({ page }) => {
    await launchApp(page, "#/read/JHN/3/ai");
    await expect(page.locator('p[data-verse="16"]').first()).toBeVisible();

    expect(registrations(page)).toEqual([]);
    expect(passages(page)[0].authorization).toBe(`Bearer ${E2E_TOKEN}`);
  });

  test("a revoked token is cleared, replaced once, and the request retried", async ({ page }) => {
    await prepareApp(page);
    // Registered after launchApp's mock, so it sees BibleQL requests first.
    await page.route("https://bibleql.org/graphql", (route) => {
      if (route.request().headers()["authorization"] !== `Bearer ${E2E_TOKEN}`) return route.fallback();
      return route.fulfill({
        status: 401,
        json: { errors: [{ message: "Invalid or missing API key", extensions: { code: "UNAUTHENTICATED" } }] }
      });
    });
    await page.goto("/#/read/JHN/3/ai");

    await expect(page.locator('p[data-verse="16"]').first()).toBeVisible();
    await waitForTauriCalls(page, "clear_install_token");
    expect(registrations(page)).toHaveLength(1);
    expect(passages(page).at(-1)?.authorization).toBe(`Bearer ${E2E_REGISTERED_TOKEN}`);
  });

  test("a failed registration falls back to the bundled sample chapter", async ({ page }) => {
    await prepareApp(page, FIRST_LAUNCH);
    await page.route("https://bibleql.org/graphql", (route) => {
      if (!(route.request().postData() ?? "").includes("registerInstallation")) return route.fallback();
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "3600" },
        json: { errors: [{ message: "Rate limit exceeded.", extensions: { code: "RATE_LIMITED", retryAfter: 3600 } }] }
      });
    });
    await page.goto("/#/read/JHN/3/ai");

    await expect(page.getByText(/Couldn't connect to BibleQL|No se pudo conectar con BibleQL/).first()).toBeVisible({ timeout: 15_000 });
    // Psalm 23, whatever the URL asked for.
    await expect(page.getByText(/23 · (WEB|RV1909)/).first()).toBeVisible();
    expect(passages(page)).toEqual([]);
  });

  test("a deprecated-key response shows a dismissible update banner", async ({ page }) => {
    await prepareApp(page);
    await page.route("https://bibleql.org/graphql", (route) => {
      if (!(route.request().postData() ?? "").includes("translations {")) return route.fallback();
      return route.fulfill({
        json: {
          data: { translations: [] },
          extensions: {
            updateRequired: true,
            message: "This version of the app is out of date.",
            updateUrl: "https://github.com/lporras/bibleql-reader/releases"
          }
        }
      });
    });
    await page.goto("/#/read/JHN/3/ai");

    const banner = page.getByRole("status").filter({ hasText: "This version of the app is out of date." });
    await expect(banner).toBeVisible();

    await banner.getByRole("link", { name: labelPattern("Get the update", "Obtener la actualización") }).click();
    const [opened] = await waitForTauriCalls(page, "plugin:opener|open_url");
    expect(opened.args).toMatchObject({ url: "https://github.com/lporras/bibleql-reader/releases" });

    await banner.getByRole("button").click();
    await expect(banner).toBeHidden();
  });
});

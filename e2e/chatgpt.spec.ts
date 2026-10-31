import { test, expect, type Locator, type Page } from "@playwright/test";
import { labelPattern, launchApp, prepareApp, tauriCalls, waitForTauriCalls } from "./helpers";

// Sign in with ChatGPT in the AI settings dialog and the Assistant's setup
// prompt, against the stub shell: src-tauri/src/chatgpt.rs is covered by its own
// tests, and nothing here reaches OpenAI.

const ACCOUNT = { sub: "sub-1", email: "reader@example.com", name: "Reader", planEnabled: true };
const CONTINUE = { name: labelPattern("Continue with ChatGPT", "Continuar con ChatGPT") };
const SIGN_OUT = { name: labelPattern("Sign out", "Cerrar sesión") };
const DIFFERENT = { name: labelPattern("Use a different account", "Usar otra cuenta") };
const GOT_IT = { name: labelPattern("Got it", "Entendido") };
const CANCEL = { name: labelPattern("^Cancel$", "^Cancelar$") };
const SETUP_TITLE = { name: labelPattern("Set up the assistant", "Configura el asistente") };
const ASK = labelPattern("Ask", "Pregunta");

function dialog(page: Page): Locator {
  return page.getByRole("dialog", { name: labelPattern("AI settings", "Ajustes de IA") });
}

async function openSettings(page: Page): Promise<Locator> {
  await page.getByTitle(labelPattern("AI settings", "Ajustes de IA")).click();
  return dialog(page);
}

/** Someone who has already dismissed the first-use welcome. */
async function alreadyWelcomed(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("biblereader.prefs", '{"chatgptWelcomed":true}'));
}

// A sign-in that waits for the browser, as the real one does, until cancelled.
async function launchWithHangingSignIn(page: Page): Promise<void> {
  await prepareApp(page);
  await page.addInitScript(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    let reject: ((reason: string) => void) | undefined;
    internals.invoke = (cmd, args) => {
      const answer = invoke(cmd, args);
      if (cmd === "chatgpt_sign_in") return new Promise((_, r) => (reject = r));
      if (cmd === "chatgpt_cancel_sign_in") reject?.("cancelled");
      return answer;
    };
  });
  await page.goto("/");
}

test.describe("Sign in with ChatGPT: AI settings", () => {
  test("the dialog offers both the API key and ChatGPT", async ({ page }) => {
    await launchApp(page);
    const settings = await openSettings(page);
    await expect(settings.getByPlaceholder("sk-ant-…")).toBeVisible();
    await expect(settings.getByRole("button", CONTINUE)).toBeVisible();
    // Nobody has signed in here, so there's no other account to differ from.
    await expect(settings.getByRole("button", DIFFERENT)).toHaveCount(0);
  });

  test("signing in shows the account and the welcome", async ({ page }) => {
    await launchApp(page, "", { chatgpt_sign_in: ACCOUNT });
    const settings = await openSettings(page);
    await settings.getByRole("button", CONTINUE).click();

    const calls = await waitForTauriCalls(page, "chatgpt_sign_in");
    expect(calls[0].args).toEqual({ newAccount: false, locale: "en" });

    const gotIt = page.getByRole("button", GOT_IT);
    await expect(gotIt).toBeVisible();
    await gotIt.click();
    await expect(gotIt).toHaveCount(0);
    await expect(settings.getByText("reader@example.com")).toBeVisible();
    await expect(settings.getByRole("button", SIGN_OUT)).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("biblereader.prefs") ?? "{}"));
    expect(stored.chatgptWelcomed).toBe(true);
    // Only safe details were kept in the browser's storage.
    const everything = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(everything).not.toContain("reader@example.com");
  });

  test("the welcome isn't shown again", async ({ page }) => {
    await alreadyWelcomed(page);
    await launchApp(page, "", { chatgpt_sign_in: ACCOUNT });
    const settings = await openSettings(page);
    await settings.getByRole("button", CONTINUE).click();
    await expect(settings.getByText("reader@example.com")).toBeVisible();
    await expect(page.getByRole("button", GOT_IT)).toHaveCount(0);
  });

  test("a sign-in without the plan scope says so and offers to reconnect", async ({ page }) => {
    await launchApp(page, "", { chatgpt_account: { ...ACCOUNT, planEnabled: false }, chatgpt_has_registration: true });
    const settings = await openSettings(page);
    await expect(settings.getByText("reader@example.com")).toBeVisible();
    await expect(settings.getByText(/didn't allow this app/)).toBeVisible();
    await expect(settings.getByRole("button", { name: labelPattern("Reconnect", "Volver a conectar") })).toBeVisible();
    await expect(page.getByRole("button", GOT_IT)).toHaveCount(0);
  });

  test("signed in, usage is managed on OpenAI's site in the system browser", async ({ page }) => {
    await alreadyWelcomed(page);
    await launchApp(page, "", { chatgpt_account: ACCOUNT, chatgpt_has_registration: true });
    const settings = await openSettings(page);
    await settings.getByRole("link", { name: labelPattern("Manage usage", "Administrar uso") }).click();
    const calls = await waitForTauriCalls(page, "plugin:opener|open_url");
    expect(calls[0].args.url).toBe("https://chatgpt.com/settings/usage");
  });

  test("signing out keeps the option of another account, and warns if revocation is unconfirmed", async ({ page }) => {
    await alreadyWelcomed(page);
    await launchApp(page, "", {
      chatgpt_account: ACCOUNT,
      chatgpt_has_registration: true,
      chatgpt_sign_out: { revoked: false }
    });
    const settings = await openSettings(page);
    await settings.getByRole("button", SIGN_OUT).click();

    await expect(settings.getByRole("alert")).toContainText(/couldn't confirm/);
    await expect(settings.getByRole("button", CONTINUE)).toBeVisible();
    await expect(settings.getByRole("button", DIFFERENT)).toBeVisible();
  });

  test("a confirmed sign-out shows no warning, and a different account registers anew", async ({ page }) => {
    await alreadyWelcomed(page);
    await launchApp(page, "", {
      chatgpt_account: ACCOUNT,
      chatgpt_has_registration: true,
      chatgpt_sign_out: { revoked: true },
      chatgpt_sign_in: { ...ACCOUNT, email: "other@example.com" }
    });
    const settings = await openSettings(page);
    await settings.getByRole("button", SIGN_OUT).click();
    await settings.getByRole("button", DIFFERENT).click();

    const calls = await waitForTauriCalls(page, "chatgpt_sign_in");
    expect(calls[0].args).toEqual({ newAccount: true, locale: "en" });
    await expect(settings.getByRole("alert")).toHaveCount(0);
  });

  test("while waiting for the browser, sign-in can be cancelled without an error", async ({ page }) => {
    await launchWithHangingSignIn(page);
    const settings = await openSettings(page);
    await settings.getByRole("button", CONTINUE).click();

    await expect(settings.getByText(/Finish signing in/)).toBeVisible();
    await expect(settings.getByRole("button", CONTINUE)).toHaveCount(0);
    await settings.getByRole("button", CANCEL).first().click();

    await expect(settings.getByRole("button", CONTINUE)).toBeVisible();
    await expect(settings.getByRole("alert")).toHaveCount(0);
  });

  test("closing the dialog gives up a sign-in in progress", async ({ page }) => {
    await launchWithHangingSignIn(page);
    const settings = await openSettings(page);
    await settings.getByRole("button", CONTINUE).click();
    await expect(settings.getByText(/Finish signing in/)).toBeVisible();

    await settings.getByRole("button", CANCEL).last().click();

    await waitForTauriCalls(page, "chatgpt_cancel_sign_in");
  });

  test("a failed sign-in explains itself in the current language", async ({ page }) => {
    await prepareApp(page);
    await page.addInitScript(() => {
      localStorage.setItem("biblereader.prefs", '{"locale":"es"}');
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> } })
        .__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      internals.invoke = (cmd) => (cmd === "chatgpt_sign_in" ? Promise.reject("account_mismatch") : invoke(cmd));
    });
    await page.goto("/");
    const settings = await openSettings(page);
    await settings.getByRole("button", CONTINUE).click();
    await expect(settings.getByRole("alert")).toContainText("Usar otra cuenta");
  });

  test("the API key still saves on its own", async ({ page }) => {
    await alreadyWelcomed(page);
    await launchApp(page, "", { chatgpt_account: ACCOUNT });
    const settings = await openSettings(page);
    await settings.getByPlaceholder("sk-ant-…").fill("sk-ant-test");
    await settings.getByRole("button", { name: labelPattern("^Save$", "^Guardar$") }).click();
    await expect(page.getByPlaceholder("sk-ant-…")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("biblereader.aikey"))).toBe("sk-ant-test");
  });
});

test.describe("Sign in with ChatGPT: the Assistant's setup prompt", () => {
  const askBox = (page: Page) => page.getByRole("button", { name: ASK, exact: false }).and(page.locator('[type="submit"]'));

  test("with nothing set up, the Assistant offers both ways in and no ask box", async ({ page }) => {
    await launchApp(page);
    await expect(page.getByRole("heading", SETUP_TITLE)).toBeVisible();
    await expect(page.getByRole("button", CONTINUE)).toBeVisible();
    await expect(page.getByRole("button", { name: labelPattern("Use an Anthropic API key", "Usar una clave") })).toBeVisible();
    await expect(askBox(page)).toHaveCount(0);
  });

  test("signing in from the prompt replaces it with the chat and shows the welcome", async ({ page }) => {
    await launchApp(page, "", { chatgpt_sign_in: ACCOUNT });
    await page.getByRole("button", CONTINUE).click();

    const gotIt = page.getByRole("button", GOT_IT);
    await expect(gotIt).toBeVisible();
    await gotIt.click();
    await expect(page.getByRole("heading", SETUP_TITLE)).toHaveCount(0);
    await expect(askBox(page)).toBeVisible();
  });

  test("the API key link opens the settings, and saving a key replaces the prompt", async ({ page }) => {
    await launchApp(page);
    await page.getByRole("button", { name: labelPattern("Use an Anthropic API key", "Usar una clave") }).click();
    const settings = dialog(page);
    await settings.getByPlaceholder("sk-ant-…").fill("sk-ant-test");
    await settings.getByRole("button", { name: labelPattern("^Save$", "^Guardar$") }).click();

    await expect(page.getByRole("heading", SETUP_TITLE)).toHaveCount(0);
    await expect(askBox(page)).toBeVisible();
  });

  test("an API key alone means no prompt", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("biblereader.aikey", "sk-ant-test"));
    await launchApp(page);
    await expect(askBox(page)).toBeVisible();
    await expect(page.getByRole("heading", SETUP_TITLE)).toHaveCount(0);
  });

  test("ChatGPT alone means no prompt", async ({ page }) => {
    await alreadyWelcomed(page);
    await launchApp(page, "", { chatgpt_account: ACCOUNT, chatgpt_has_registration: true });
    await expect(askBox(page)).toBeVisible();
    await expect(page.getByRole("heading", SETUP_TITLE)).toHaveCount(0);
  });

  test("a sign-in that can't use the plan still gets the prompt, with a way to fix it", async ({ page }) => {
    await launchApp(page, "", { chatgpt_account: { ...ACCOUNT, planEnabled: false }, chatgpt_has_registration: true });
    await expect(page.getByRole("heading", SETUP_TITLE)).toBeVisible();
    await expect(page.getByRole("button", { name: labelPattern("Reconnect", "Volver a conectar") })).toBeVisible();
    await expect(askBox(page)).toHaveCount(0);
  });

  for (const platform of ["ios", "android"]) {
    test(`on ${platform} the prompt offers only the API key, and ChatGPT is hidden everywhere`, async ({ page }) => {
      await launchApp(page, "", { __platform: platform });
      await expect(page.getByRole("heading", SETUP_TITLE)).toBeVisible();
      await expect(page.getByRole("button", CONTINUE)).toHaveCount(0);

      await page.getByRole("button", { name: labelPattern("Use an Anthropic API key", "Usar una clave") }).click();
      await expect(dialog(page).getByPlaceholder("sk-ant-…")).toBeVisible();
      await expect(page.getByRole("button", CONTINUE)).toHaveCount(0);
      expect((await tauriCalls(page)).filter((call) => call.cmd.startsWith("chatgpt_"))).toEqual([]);
    });
  }
});

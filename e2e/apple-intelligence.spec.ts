import { test, expect, type Page } from "@playwright/test";
import { labelPattern, launchApp, prepareApp, tauriCalls, waitForTauriCalls } from "./helpers";

// Apple Intelligence as the Assistant's provider, against the stub shell: the
// on-device model can't run in a browser, so the plugin's two commands are
// answered here (plugins/tauri-plugin-appleai). Nothing reaches a network.

const AVAILABILITY = "plugin:appleai|availability";
const RESPOND = "plugin:appleai|respond";
const ANSWER = { answer: "A priest and king.", references: [{ ref: "Genesis 14:18", why: "He appears." }] };
const SETUP_TITLE = { name: labelPattern("Set up the assistant", "Configura el asistente") };
const USE_APPLE = { name: labelPattern("Use Apple Intelligence", "Usar Apple Intelligence") };
const QUESTION = labelPattern("What does the Bible say", "Qué dice la Biblia");
const providerSelect = (page: Page) => page.getByLabel(labelPattern("^Answers from", "^Responde"));
const modelSelect = (page: Page) => page.getByLabel(labelPattern("^Model", "^Modelo"));
const sendButton = (page: Page) => page.getByRole("button", { name: labelPattern("^Ask$", "^Preguntar$") });

// Plays a reply through the Channel, as the plugin does.
async function launchWithModel(
  page: Page,
  tauri: Record<string, unknown>,
  events: unknown[] = [{ type: "partial", ...ANSWER }, { type: "completed" }]
): Promise<void> {
  await prepareApp(page, tauri);
  await page.addInitScript((events: unknown[]) => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: never) => Promise<unknown> } })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    internals.invoke = async (cmd, args) => {
      const answer = await invoke(cmd, args);
      if (cmd === "plugin:appleai|respond") {
        const channel = (args as unknown as { onEvent: { onmessage: (event: unknown) => void } }).onEvent;
        events.forEach((event) => channel.onmessage(event));
      }
      return answer;
    };
  }, events);
  await page.goto("/");
}

async function askQuestion(page: Page, text = "Who is Melchizedek?"): Promise<void> {
  await page.getByPlaceholder(QUESTION).fill(text);
  await sendButton(page).click();
}

test.describe("Answering with Apple Intelligence", () => {
  test("on an iPad with Apple Intelligence and no key, it answers on the device", async ({ page }) => {
    await launchWithModel(page, { __platform: "ios", [AVAILABILITY]: "available" });
    await expect(providerSelect(page)).toHaveValue("apple");
    await expect(modelSelect(page)).toHaveValue("system");
    await expect(modelSelect(page)).toBeDisabled();
    await expect(page.getByText(labelPattern("Runs on this device", "Funciona en este dispositivo"))).toBeVisible();
    // ChatGPT sign-in isn't offered on iOS.
    await expect(providerSelect(page).locator("option")).toHaveText(["Claude (add a key)", "Apple Intelligence"]);

    await askQuestion(page);

    await expect(page.getByText("A priest and king.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Genesis 14:18", exact: true })).toBeVisible();
    const calls = await waitForTauriCalls(page, RESPOND);
    expect(calls[0].args.prompt).toBe("Who is Melchizedek?");
    expect(calls[0].args.instructions).toContain("Escribe todo en inglés");
    const status = await waitForTauriCalls(page, AVAILABILITY);
    expect(status[0].args).toEqual({ locale: "en" });
  });

  test("on a Mac every provider is offered", async ({ page }) => {
    await launchWithModel(page, { __platform: "macos", [AVAILABILITY]: "available" });
    await expect(providerSelect(page).locator("option")).toHaveText(["Claude (add a key)", "ChatGPT", "Apple Intelligence"]);
  });

  test("a failure is explained, not shown as an answer", async ({ page }) => {
    await launchWithModel(page, { __platform: "ios", [AVAILABILITY]: "available" }, [
      { type: "failed", code: "guardrailViolation", message: "Unsafe content" }
    ]);
    await askQuestion(page);
    await expect(page.getByText(/declined to answer that/)).toBeVisible();
  });

  test("a model still downloading says so and blocks asking, without switching to a billed key", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("biblereader.prefs", '{"aiProvider":"apple"}'));
    await page.addInitScript(() => localStorage.setItem("biblereader.aikey", "sk-ant-test"));
    await launchWithModel(page, { __platform: "macos", [AVAILABILITY]: "modelNotReady" });
    await expect(providerSelect(page)).toHaveValue("apple");
    await expect(page.getByText(/still downloading its model/)).toBeVisible();
    await expect(sendButton(page)).toBeDisabled();
  });

  test("a device that could have it, but has it switched off, is offered it in the setup prompt", async ({ page }) => {
    await launchApp(page, "", { __platform: "ios", [AVAILABILITY]: "appleIntelligenceNotEnabled" });
    await expect(page.getByRole("heading", SETUP_TITLE)).toBeVisible();
    await page.getByRole("button", USE_APPLE).click();
    await expect(providerSelect(page)).toHaveValue("apple");
    await expect(page.getByText(/Turn on Apple Intelligence in Settings/)).toBeVisible();
    await expect(sendButton(page)).toBeDisabled();
  });

  test("a device without Apple Intelligence isn't offered it", async ({ page }) => {
    await launchApp(page, "", { __platform: "ios", [AVAILABILITY]: "deviceNotEligible" });
    await expect(page.getByRole("heading", SETUP_TITLE)).toBeVisible();
    await expect(page.getByRole("button", USE_APPLE)).toHaveCount(0);
  });

  test("off Apple platforms the model is never asked about", async ({ page }) => {
    await launchApp(page);
    await expect(page.getByRole("heading", SETUP_TITLE)).toBeVisible();
    await expect(page.getByRole("button", USE_APPLE)).toHaveCount(0);
    expect((await tauriCalls(page)).filter((call) => call.cmd.startsWith("plugin:appleai"))).toEqual([]);
  });
});

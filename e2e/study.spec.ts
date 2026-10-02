import { test, expect, type Page } from "@playwright/test";
import { launchApp, waitForTauriCalls } from "./helpers";

// Studies: collect verses from the reader, write the study, export it.
// BibleQL is mocked by launchApp; the PDF "Save As" dialog is stubbed to
// cancel (helpers.ts), so the export is asserted on the dialog call itself.

async function addVerse16ToStudy(page: Page): Promise<void> {
  await launchApp(page, "#/read/JHN/3/ai");
  await page.waitForSelector('p[data-verse="16"]');
  await page.locator('p[data-verse="16"]').first().click({ position: { x: 20, y: 10 } });
  await page.getByRole("button", { name: /^(Add to study|Al estudio)$/i }).click();
}

test.describe("Studies", () => {
  test("adding a selection starts a study and confirms in place", async ({ page }) => {
    await addVerse16ToStudy(page);

    // The toolbar stays up and flips to "In study" — no second add.
    const inStudy = page.getByRole("button", { name: /^(In study|En el estudio)$/i });
    await expect(inStudy).toBeVisible();
    await expect(inStudy).toBeDisabled();

    await page.getByRole("button", { name: /^(Sermon|Sermón)$/ }).click();
    await expect(page).toHaveURL(/#\/read\/JHN\/3\/study/);
    const card = page.locator("[data-passage]");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(/John 3:16|Juan 3:16/);
    await expect(card).toContainText("God so loved the world");
  });

  test("the same verses can be added again in another translation", async ({ page }) => {
    await addVerse16ToStudy(page);
    await expect(page.getByRole("button", { name: /^(In study|En el estudio)$/i })).toBeVisible();

    // Switch the primary translation the way a restart would see it: through
    // the persisted prefs (TranslationCombo writes the same key).
    await page.waitForTimeout(400); // the study store coalesces writes
    await page.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem("biblereader.prefs") || "{}");
      localStorage.setItem("biblereader.prefs", JSON.stringify({ ...prefs, transA: "spa-rv1909" }));
    });
    await page.reload();
    await page.waitForSelector('p[data-verse="16"]');
    await page.locator('p[data-verse="16"]').first().click({ position: { x: 20, y: 10 } });

    // Not "In study": it's only in the study in the other translation.
    await page.getByRole("button", { name: /^(Add to study|Al estudio)$/i }).click();
    await expect(page.getByRole("button", { name: /^(In study|En el estudio)$/i })).toBeDisabled();

    await page.getByRole("button", { name: /^(Sermon|Sermón)$/ }).click();
    const cards = page.locator("[data-passage]");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("eng-web");
    await expect(cards.nth(0)).toContainText("God so loved the world");
    await expect(cards.nth(1)).toContainText("spa-rv1909");
    await expect(cards.nth(1)).toContainText("de tal manera amó Dios al mundo");
  });

  test("the study page writes notes, inserts passages, and exports a PDF", async ({ page }) => {
    await addVerse16ToStudy(page);
    await page.getByRole("button", { name: /^(Sermon|Sermón)$/ }).click();
    await page.getByRole("button", { name: /^(Open study|Abrir estudio)$/ }).click();
    await expect(page).toHaveURL(/#\/study\/[\w-]+$/);

    await page.getByRole("textbox", { name: /Sermon or study title|Título del sermón/i }).fill("Love that gives");

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("First point");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^(Bold|Negrita)$/ }).click();
    await page.keyboard.type("God gave");
    await expect(editor.locator("> p strong")).toHaveText("God gave");

    await page.getByRole("button", { name: /Insert into notes|Insertar en las notas/i }).click();
    await expect(editor.locator("blockquote")).toContainText("God so loved the world");
    await expect(editor.locator("blockquote")).toContainText(/John 3:16|Juan 3:16/);

    await page.getByRole("button", { name: /^(Export PDF|Exportar PDF)$/ }).click();
    const [save] = await waitForTauriCalls(page, "plugin:dialog|save");
    expect(JSON.stringify(save.args)).toContain("Love-that-gives.pdf");

    // Everything above is persisted: a reload comes back to the same study.
    await page.waitForTimeout(400); // the store coalesces writes (StudiesContext)
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Sermon or study title|Título del sermón/i })).toHaveValue(
      "Love that gives"
    );
    await expect(page.locator(".ProseMirror > p strong")).toHaveText("God gave");
  });

  test("the title bar opens the current study", async ({ page }) => {
    await addVerse16ToStudy(page);
    await page.getByRole("button", { name: /^(Studies|Estudios)$/ }).click();
    await expect(page).toHaveURL(/#\/study\/[\w-]+$/);
    await expect(page.locator("[data-passage]")).toContainText(/John 3:16|Juan 3:16/);
  });
});

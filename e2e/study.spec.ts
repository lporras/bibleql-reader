import { test, expect, type Page } from "@playwright/test";
import { launchApp, tauriCalls, waitForTauriCalls } from "./helpers";

// A 4×3 PNG, small enough to inline: what the image button is handed.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGM44KAARww4OQAO9g2B1lieTwAAAABJRU5ErkJggg==", "base64");

/** The bytes the PDF export handed to `plugin:fs|write_file`, as a latin1 string. */
async function writtenPdf(page: Page): Promise<string> {
  await waitForTauriCalls(page, "plugin:fs|write_file");
  return page.evaluate(() => {
    const call = window.__TAURI_CALLS__.find((c) => c.cmd === "plugin:fs|write_file")!;
    const bytes = call.args as unknown as Uint8Array;
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  });
}

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
    await expect(cards.nth(0)).toContainText("WEB");
    await expect(cards.nth(0)).toContainText("God so loved the world");
    await expect(cards.nth(1)).toContainText("RV1909");
    await expect(cards.nth(1)).toContainText("de tal manera amó Dios al mundo");

    // The reader is on RV1909; opening the WEB card switches it to WEB.
    await cards.nth(0).getByRole("button", { name: /John 3:16|Juan 3:16/ }).first().click();
    await expect(page).toHaveURL(/#\/read\/JHN\/3\/study\?from=16&to=16/);
    await expect(page.locator('p[data-verse="16"]').first()).toContainText("God so loved the world");
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
    // Attributed with its translation.
    await expect(editor.locator("blockquote strong")).toHaveText(/^(John|Juan) 3:16 \(WEB\)$/);

    await page.getByRole("button", { name: /^(Export PDF|Exportar PDF)$/ }).click();
    const [save] = await waitForTauriCalls(page, "plugin:dialog|save");
    expect(JSON.stringify(save.args)).toContain("Love-that-gives.pdf");
    // Cancelling the dialog saves nothing, so there's nothing to open.
    await page.waitForTimeout(200);
    expect((await tauriCalls(page)).some((c) => c.cmd === "plugin:opener|open_path")).toBe(false);

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
    await page.getByRole("button", { name: /^(Sermons|Sermones)$/ }).click();
    await expect(page).toHaveURL(/#\/study\/[\w-]+$/);
    await expect(page.locator("[data-passage]")).toContainText(/John 3:16|Juan 3:16/);
  });

  test("a new study starts untitled, on the title placeholder", async ({ page }) => {
    await launchApp(page, "#/study");
    await expect(page).toHaveURL(/#\/study\/[\w-]+$/);
    const title = page.getByRole("textbox", { name: /Sermon or study title|Título del sermón/i });
    await expect(title).toHaveValue("");
    await expect(title).toBeFocused();
    await page.keyboard.type("Grace");
    await expect(title).toHaveValue("Grace");
  });

  test("the editor aligns, links, divides, and attaches images and videos that export to the PDF", async ({ page }) => {
    // The YouTube embed is an iframe: never let it reach YouTube.
    await page.route(/youtube(-nocookie)?\.com/, (route) => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
    await launchApp(page, "#/study", { "plugin:dialog|save": "/Users/me/Documents/Grace.pdf" });
    await page.getByRole("textbox", { name: /Sermon or study title|Título del sermón/i }).fill("Grace");

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Saved by grace");
    await page.getByRole("button", { name: /^(Center|Centrar)$/ }).click();
    await expect(editor.locator("> p").first()).toHaveAttribute("style", /text-align: center/);
    await page.keyboard.press("Enter");

    // Link with nothing selected: the address goes in as its own text.
    await page.getByRole("button", { name: /^(Link|Enlace)$/ }).click();
    await page.getByRole("textbox", { name: /Link address|Dirección del enlace/ }).fill("bibleql.org");
    await page.keyboard.press("Enter");
    await expect(editor.locator('a[href="https://bibleql.org"]')).toHaveText("bibleql.org");

    await page.getByRole("button", { name: /^(Divider|Línea divisoria)$/ }).click();
    await expect(editor.locator("hr")).toHaveCount(1);

    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "sunrise.png", mimeType: "image/png", buffer: PNG });
    await expect(editor.locator("img")).toHaveAttribute("src", /^blob:/);

    await page.getByRole("button", { name: /^(Insert YouTube video|Insertar video de YouTube)$/ }).click();
    const videoUrl = page.getByRole("textbox", { name: /YouTube link|Enlace de YouTube/ });
    await videoUrl.fill("https://example.com/not-a-video");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toHaveText(/isn't a YouTube link|no es un enlace de YouTube/);
    await videoUrl.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await page.keyboard.press("Enter");
    await expect(editor.locator("iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    // Each insert leaves the caret after it, so nothing replaced the image.
    await expect(editor.locator("img")).toHaveCount(1);
    await page.keyboard.type("Amen");
    await expect(editor.locator("> p").last()).toHaveText("Amen");

    await page.getByRole("button", { name: /^(Export PDF|Exportar PDF)$/ }).click();
    const pdf = await writtenPdf(page);
    expect(pdf).toContain("/Subtype /Image /Width 4 /Height 3");
    expect(pdf).toContain("/Filter /DCTDecode");
    expect(pdf).toContain("/URI (https://bibleql.org/)");
    expect(pdf).toContain("(https://www.youtube.com/watch?v=dQw4w9WgXcQ) Tj");
    // …then opens it in the default PDF viewer.
    const [open] = await waitForTauriCalls(page, "plugin:opener|open_path");
    expect(open.args).toMatchObject({ path: "/Users/me/Documents/Grace.pdf" });

    // The image survives a reload: the body keeps its reference, IndexedDB the bytes.
    await page.waitForTimeout(400); // the store coalesces writes (StudiesContext)
    await page.reload();
    await expect(page.locator(".ProseMirror img")).toHaveAttribute("src", /^blob:/);
    expect(await page.locator(".ProseMirror img").evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBe(4);
  });
});

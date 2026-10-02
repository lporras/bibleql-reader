import { passageReference, translationAbbrev } from "../../state/study";
import { drawImage, loadStudyImage } from "../../state/studyImages";
import { STR, type Locale } from "../../data/strings";
import type { Study } from "../../types/study";
import { layoutBlocks, type Align, type Block, type Measure, type Run } from "./layout";
import { toWinAnsiText } from "./winAnsi";
import { writePdf, type FontKey, type PdfImage } from "./writer";

// Study -> PDF bytes. The pieces that need a browser (parsing the editor's
// HTML, decoding images, measuring text on a canvas) are confined to this
// file; layout.ts and writer.ts underneath are pure and unit-tested.

/** An href the PDF can link to, as plain ASCII — or undefined. */
function pdfHref(href: string | null): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function runsFrom(nodes: Node[], bold = false, italic = false, href?: string, out: Run[] = []): Run[] {
  for (const child of nodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push({ text: toWinAnsiText(child.textContent ?? ""), bold, italic, href });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName;
      if (tag === "BR") out.push({ text: "\n", bold, italic });
      else if (tag === "UL" || tag === "OL") continue; // nested lists become their own blocks
      else
        runsFrom(
          Array.from(child.childNodes),
          bold || tag === "STRONG" || tag === "B",
          italic || tag === "EM" || tag === "I",
          tag === "A" ? pdfHref(el.getAttribute("href")) : href,
          out
        );
    }
  }
  return out;
}

/** TextAlign writes `style="text-align: center"`; left is the default and never written. */
function alignOf(el: Element): Align | undefined {
  const value = (el as HTMLElement).style?.textAlign;
  return value === "center" || value === "right" || value === "justify" ? value : undefined;
}

/** A YouTube embed's iframe src, back to the watch URL a reader of the printout can open. */
function youtubeWatchUrl(embed: string | null): string | undefined {
  const id = embed?.match(/\/embed\/([\w-]+)/)?.[1];
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}

/** How an <img src> appears in the PDF: its index in the document's images and pixel size. */
export type ImageLookup = (src: string) => { index: number; width: number; height: number } | null;

function inlineRuns(node: Node): Run[] {
  return runsFrom(Array.from(node.childNodes));
}

function listBlocks(list: Element, depth: number, out: Block[]): void {
  const ordered = list.tagName === "OL";
  let n = Number(list.getAttribute("start")) || 1;
  for (const li of Array.from(list.children)) {
    if (li.tagName !== "LI") continue;
    // TipTap wraps list item text in <p>; a multi-paragraph item becomes
    // several blocks, the marker on the first only.
    let marked = false;
    const marker = ordered ? `${n}.` : "•";
    for (const child of Array.from(li.childNodes)) {
      const tag = child.nodeType === Node.ELEMENT_NODE ? (child as Element).tagName : "";
      if (tag === "UL" || tag === "OL") {
        listBlocks(child as Element, depth + 1, out);
      } else {
        const runs = tag === "P" ? inlineRuns(child) : runsFrom([child]);
        if (!runs.some((r) => r.text.trim())) continue;
        out.push({ style: "body", runs, depth, marker: marked ? undefined : marker });
        marked = true;
      }
    }
    n++;
  }
}

/**
 * The study editor's HTML (TipTap's output) as layout blocks. An image
 * `images` doesn't know (it couldn't be loaded) is left out.
 */
export function htmlToBlocks(html: string, images: ImageLookup = () => null): Block[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: Block[] = [];
  function walk(parent: Element, quoted: boolean): void {
    for (const el of Array.from(parent.children)) {
      switch (el.tagName) {
        case "H1":
        case "H2":
          out.push({ style: "h2", runs: inlineRuns(el), align: alignOf(el) });
          break;
        case "H3":
        case "H4":
          out.push({ style: "h3", runs: inlineRuns(el), align: alignOf(el) });
          break;
        case "HR":
          out.push({ style: "rule", runs: [] });
          break;
        case "IMG": {
          const image = images(el.getAttribute("src") ?? "");
          if (image) out.push({ style: "image", runs: [], image });
          break;
        }
        case "DIV": {
          // A YouTube embed (<div data-youtube-video><iframe>) prints as its link.
          const url = el.hasAttribute("data-youtube-video") ? youtubeWatchUrl(el.querySelector("iframe")?.getAttribute("src") ?? null) : undefined;
          if (url) out.push({ style: "body", runs: [{ text: "YouTube: " }, { text: url, href: url }] });
          else walk(el, quoted);
          break;
        }
        case "BLOCKQUOTE":
          walk(el, true);
          break;
        case "UL":
        case "OL":
          listBlocks(el, 1, out);
          break;
        default:
          out.push({ style: quoted ? "quote" : "body", runs: inlineRuns(el), align: alignOf(el) });
      }
    }
  }
  walk(doc.body, false);
  // The editor always ends on an empty paragraph (and "Insert into notes"
  // adds one after the quote); trailing blanks would print as a gap.
  while (out.length && isBlank(out[out.length - 1])) out.pop();
  return out;
}

function isBlank(block: Block): boolean {
  return block.style !== "rule" && block.style !== "image" && !block.runs.some((r) => r.text.trim());
}

export function studyBlocks(study: Study, locale: Locale, bodyBlocks: Block[]): Block[] {
  const t = STR[locale];
  const edited = new Date(study.updatedAt).toLocaleDateString(locale === "es" ? "es" : "en", { dateStyle: "long" });
  const blocks: Block[] = [
    { style: "title", runs: [{ text: toWinAnsiText(study.title.trim() || t.untitledStudy) }] },
    { style: "meta", runs: [{ text: toWinAnsiText(edited) }] },
    ...bodyBlocks
  ];
  if (study.passages.length) {
    blocks.push({ style: "section", runs: [{ text: toWinAnsiText(t.passages.toUpperCase()) }] });
    for (const p of study.passages) {
      blocks.push({
        style: "reference",
        runs: [{ text: toWinAnsiText(`${passageReference(p, locale)}  ·  ${translationAbbrev(p.translationId)}`) }]
      });
      if (p.text) blocks.push({ style: "scripture", runs: [{ text: toWinAnsiText(p.text) }] });
      if (p.why) blocks.push({ style: "why", runs: [{ text: toWinAnsiText(p.why) }] });
    }
  }
  return blocks;
}

// Times and Helvetica are the PDF's built-in fonts; measuring with their
// on-screen equivalents (or metric-compatible stand-ins: Arial, Liberation)
// gets line breaks that match what the viewer renders. layout.ts leaves a
// little slack for where only a lookalike is installed.
const CSS_FAMILY = {
  serif: '"Times New Roman", Times, "Liberation Serif", serif',
  sans: 'Helvetica, Arial, "Liberation Sans", sans-serif'
};

function canvasMeasure(): Measure {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  const cache = new Map<string, number>();
  return (text: string, font: FontKey, size: number) => {
    const key = `${font}|${size}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const family = font.startsWith("sans") ? CSS_FAMILY.sans : CSS_FAMILY.serif;
    const weight = font.includes("bold") ? "bold " : "";
    const style = font.includes("italic") ? "italic " : "";
    ctx.font = `${style}${weight}${size}px ${family}`;
    const width = ctx.measureText(text).width;
    cache.set(key, width);
    return width;
  };
}

/**
 * An image from the body as a JPEG the PDF can embed: stored images from
 * IndexedDB, anything else (pasted from the web) fetched — which may fail on
 * CORS or offline, in which case the image is skipped. Flattened onto
 * white, since JPEG has no transparency.
 */
async function pdfImage(src: string): Promise<PdfImage | null> {
  try {
    const blob = (await loadStudyImage(src)) ?? (/^https?:/.test(src) ? await (await fetch(src)).blob() : null);
    if (!blob) return null;
    const canvas = await drawImage(blob, 2000, "#ffffff");
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!jpeg) return null;
    return { data: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

export async function renderStudyPdf(study: Study, locale: Locale): Promise<Uint8Array> {
  const title = study.title.trim() || STR[locale].untitledStudy;
  const srcs = [...new Set(Array.from(new DOMParser().parseFromString(study.descriptionHtml, "text/html").images, (img) => img.getAttribute("src") ?? ""))];
  const images: PdfImage[] = [];
  const bySrc = new Map<string, { index: number; width: number; height: number }>();
  for (const src of srcs) {
    const image = src ? await pdfImage(src) : null;
    if (!image) continue;
    bySrc.set(src, { index: images.length, width: image.width, height: image.height });
    images.push(image);
  }
  const blocks = studyBlocks(study, locale, htmlToBlocks(study.descriptionHtml, (src) => bySrc.get(src) ?? null));
  const pages = layoutBlocks(blocks, canvasMeasure(), { footer: toWinAnsiText(title) });
  return writePdf({ width: 612, height: 792, pages, title, images });
}

/** "Grace-that-saves.pdf" — keeps letters (accented too), digits and dashes. */
export function studyPdfFilename(title: string, fallback: string): string {
  const base = (title.trim() || fallback)
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "study"}.pdf`;
}

import type { FontKey, PdfPage, Rgb } from "./writer";

// Flows styled blocks onto pages: greedy word wrap, alignment, page breaks,
// list markers, block-quote rules, links, dividers, images and a footer. Pure — text measurement is
// injected, so the browser passes a canvas-backed measure (lib/pdf/
// studyPdf.ts) and the tests pass a fixed-width one.

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** An http(s)/mailto URL: drawn in the link color, clickable in the PDF. */
  href?: string;
}

export type BlockStyle =
  | "title"
  | "meta"
  | "h2"
  | "h3"
  | "body"
  | "quote"
  | "section"
  | "reference"
  | "scripture"
  | "why"
  | "rule"
  | "image";

export type Align = "left" | "center" | "right" | "justify";

export interface Block {
  style: BlockStyle;
  runs: Run[];
  /** List nesting depth (0 = not in a list). */
  depth?: number;
  /** "•" or "3." — drawn in the gutter left of the first line. */
  marker?: string;
  align?: Align;
  /** For "image" blocks: PdfDocument.images index and pixel size. */
  image?: { index: number; width: number; height: number };
}

export type Measure = (text: string, font: FontKey, size: number) => number;

export interface PageGeometry {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/** US Letter, 1-inch margins. */
export const LETTER: PageGeometry = { width: 612, height: 792, margin: { top: 72, right: 72, bottom: 72, left: 72 } };

interface StyleSpec {
  family: "serif" | "sans";
  size: number;
  leading: number;
  before: number;
  after: number;
  color: Rgb;
  bold?: boolean;
  italic?: boolean;
  indent?: number;
  /** A vertical rule left of the text (block quotes). */
  rule?: boolean;
  /** Pull the next block onto the same page (headings). */
  keepWithNext?: boolean;
}

const INK: Rgb = [0.13, 0.12, 0.11];
const MUTED: Rgb = [0.38, 0.36, 0.36];
const ACCENT: Rgb = [0.49, 0.33, 0.07];
const LINK: Rgb = [0.12, 0.32, 0.62];

const STYLES: Record<BlockStyle, StyleSpec> = {
  title: { family: "serif", size: 24, leading: 29, before: 0, after: 4, color: INK, bold: true },
  meta: { family: "sans", size: 9, leading: 13, before: 0, after: 18, color: MUTED },
  h2: { family: "serif", size: 17, leading: 22, before: 14, after: 5, color: INK, bold: true, keepWithNext: true },
  h3: { family: "serif", size: 13.5, leading: 18, before: 10, after: 4, color: INK, bold: true, keepWithNext: true },
  body: { family: "serif", size: 11.5, leading: 16, before: 0, after: 7, color: INK },
  quote: { family: "serif", size: 11.5, leading: 16, before: 2, after: 8, color: MUTED, italic: true, indent: 16, rule: true },
  section: { family: "sans", size: 9, leading: 13, before: 20, after: 8, color: ACCENT, bold: true, keepWithNext: true },
  reference: { family: "sans", size: 10, leading: 14, before: 8, after: 2, color: ACCENT, bold: true, keepWithNext: true },
  scripture: { family: "serif", size: 11.5, leading: 16, before: 0, after: 4, color: INK },
  why: { family: "serif", size: 10, leading: 14, before: 0, after: 6, color: MUTED, italic: true, indent: 10, rule: true },
  // Drawn by layoutBlocks itself; only the spacing applies.
  rule: { family: "serif", size: 11.5, leading: 0, before: 10, after: 16, color: MUTED },
  image: { family: "serif", size: 11.5, leading: 0, before: 6, after: 12, color: INK }
};

/** Images print at 96 px to the inch — their on-screen size — or smaller to fit. */
const PX = 0.75;

const LIST_INDENT = 18;

// Lines are broken against a slightly narrower measure than the column:
// text is measured with the on-screen fonts, the PDF renders with the
// built-in Times/Helvetica, and where only a lookalike is installed the two
// can differ by a percent or so. Positions within a line use the measured
// widths as-is, so this never opens gaps between runs.
const WRAP_SLACK = 0.98;

export function fontFor(family: "serif" | "sans", bold: boolean, italic: boolean): FontKey {
  if (family === "sans") return bold ? "sans-bold" : "sans";
  if (bold && italic) return "serif-bolditalic";
  if (bold) return "serif-bold";
  if (italic) return "serif-italic";
  return "serif";
}

interface Token {
  text: string;
  font: FontKey;
  href?: string;
  space: boolean;
  newline: boolean;
}

// HTML whitespace semantics: runs of spaces collapse to one, "\n" (a <br>)
// is a hard break.
function tokenize(runs: Run[], spec: StyleSpec): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    const font = fontFor(spec.family, !!(spec.bold || run.bold), !!(spec.italic || run.italic));
    const href = run.href;
    for (const part of run.text.split(/(\n|[ \u00a0]+)/)) {
      if (!part) continue;
      if (part === "\n") tokens.push({ text: "", font, space: false, newline: true });
      else if (/^[ \u00a0]+$/.test(part)) {
        const prev = tokens[tokens.length - 1];
        if (prev && !prev.space && !prev.newline) tokens.push({ text: " ", font, href, space: true, newline: false });
      } else tokens.push({ text: part, font, href, space: false, newline: false });
    }
  }
  return tokens;
}

interface Segment {
  text: string;
  font: FontKey;
  x: number;
  href?: string;
}

interface Line {
  segments: Segment[];
  /** Ends at a hard break (a <br>) or the end of the block — never justified. */
  hard: boolean;
}

/** Greedy wrap into lines of positioned segments (x relative to the line start). */
export function wrap(runs: Run[], style: BlockStyle, maxWidth: number, measure: Measure): Segment[][] {
  return wrapLines(runs, style, maxWidth, measure).map((line) => line.segments);
}

function wrapLines(runs: Run[], style: BlockStyle, maxWidth: number, measure: Measure): Line[] {
  const spec = STYLES[style];
  const lines: Line[] = [];
  let line: Segment[] = [];
  let x = 0;
  let pendingSpace: Token | null = null;

  function push(text: string, font: FontKey, href: string | undefined): void {
    const last = line[line.length - 1];
    if (last && last.font === font && last.href === href) last.text += text;
    else line.push({ text, font, x, href });
    x += measure(text, font, spec.size);
  }

  function breakLine(hard: boolean): void {
    lines.push({ segments: line, hard });
    line = [];
    x = 0;
    pendingSpace = null;
  }

  for (const token of tokenize(runs, spec)) {
    if (token.newline) {
      breakLine(true);
      continue;
    }
    if (token.space) {
      if (line.length) pendingSpace = token;
      continue;
    }
    const spaceWidth = pendingSpace ? measure(" ", pendingSpace.font, spec.size) : 0;
    let width = measure(token.text, token.font, spec.size);
    if (line.length && x + spaceWidth + width > maxWidth) breakLine(false);
    else if (pendingSpace) push(" ", pendingSpace.font, pendingSpace.href);
    pendingSpace = null;

    // A single word wider than the line (a URL, say) is split by character.
    let word = token.text;
    while (width > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && measure(word.slice(0, cut), token.font, spec.size) > maxWidth - x) cut--;
      push(word.slice(0, cut), token.font, token.href);
      breakLine(false);
      word = word.slice(cut);
      width = measure(word, token.font, spec.size);
    }
    push(word, token.font, token.href);
  }
  if (line.length || !lines.length) lines.push({ segments: line, hard: true });
  return lines;
}

function spaces(text: string): number {
  return text.split(" ").length - 1;
}

export interface LayoutOptions {
  geometry?: PageGeometry;
  /** Left footer text (the study title); the right side is "n / N". */
  footer?: string;
}

export function layoutBlocks(blocks: Block[], measure: Measure, options: LayoutOptions = {}): PdfPage[] {
  const g = options.geometry ?? LETTER;
  const bottom = g.height - g.margin.bottom;
  const contentWidth = g.width - g.margin.left - g.margin.right;
  const pages: PdfPage[] = [{ ops: [] }];
  let y = g.margin.top;
  let atTop = true;

  function newPage(): void {
    pages.push({ ops: [] });
    y = g.margin.top;
    atTop = true;
  }

  blocks.forEach((block, index) => {
    const spec = STYLES[block.style];
    const depth = block.depth ?? 0;
    const left = g.margin.left + (spec.indent ?? 0) + depth * LIST_INDENT;
    const avail = g.width - g.margin.right - left;

    if (block.style === "rule") {
      if (!atTop) y += spec.before;
      if (y + spec.after > bottom) newPage();
      const x2 = g.width - g.margin.right;
      pages[pages.length - 1].ops.push({ kind: "line", x1: left, y1: y, x2, y2: y, width: 0.75, color: [0.8, 0.79, 0.78] });
      y += spec.after;
      atTop = false;
      return;
    }

    if (block.style === "image") {
      if (!block.image) return;
      const { index: image, width: pw, height: ph } = block.image;
      // Natural size, shrunk to the column and to a full page's height.
      const scale = Math.min(PX, avail / pw, (bottom - g.margin.top) / ph);
      const width = pw * scale;
      const height = ph * scale;
      if (!atTop) y += spec.before;
      if (y + height > bottom) newPage();
      pages[pages.length - 1].ops.push({ kind: "image", x: left + (avail - width) / 2, y, width, height, image });
      y += height + spec.after;
      atTop = false;
      return;
    }

    const lines = wrapLines(block.runs, block.style, avail * WRAP_SLACK, measure);
    if (lines.length === 1 && !lines[0].segments.length && !block.marker) {
      // An empty paragraph still takes a line, as it does on screen.
      y += atTop ? 0 : spec.leading;
      return;
    }

    if (!atTop) y += spec.before;
    // Headings never sit alone at the foot of a page: require room for the
    // heading plus a couple of lines of whatever follows.
    const next = blocks[index + 1];
    const reserve = spec.keepWithNext && next ? STYLES[next.style].leading * 2 : 0;
    if (!atTop && y + spec.leading * Math.min(lines.length, 2) + reserve > bottom) newPage();

    lines.forEach(({ segments, hard }, i) => {
      if (y + spec.leading > bottom) newPage();
      // Alignment within the column. Justified lines spread the slack over
      // their spaces (PDF word spacing), except a paragraph's last line.
      const last = segments[segments.length - 1];
      const lineWidth = last ? last.x + measure(last.text, last.font, spec.size) : 0;
      const slack = Math.max(0, avail - lineWidth);
      const gaps = segments.reduce((n, seg) => n + spaces(seg.text), 0);
      const shift = block.align === "center" ? slack / 2 : block.align === "right" ? slack : 0;
      const ws = block.align === "justify" && !hard && gaps ? slack / gaps : 0;
      const baseline = y + spec.size;
      const page = pages[pages.length - 1].ops;
      if (i === 0 && block.marker) {
        const font = fontFor(spec.family, false, false);
        const w = measure(block.marker, font, spec.size);
        page.push({ kind: "text", x: left - 6 - w, y: baseline, text: block.marker, font, size: spec.size, color: spec.color });
      }
      let gapsBefore = 0;
      for (const seg of segments) {
        const x = left + shift + seg.x + gapsBefore * ws;
        const n = spaces(seg.text);
        gapsBefore += n;
        const color = seg.href ? LINK : spec.color;
        page.push({ kind: "text", x, y: baseline, text: seg.text, font: seg.font, size: spec.size, color, wordSpacing: ws || undefined });
        if (seg.href) {
          const width = measure(seg.text, seg.font, spec.size) + n * ws;
          const uy = baseline + 1.5;
          page.push({ kind: "line", x1: x, y1: uy, x2: x + width, y2: uy, width: 0.5, color: LINK });
          page.push({ kind: "link", x, y, width, height: spec.leading, href: seg.href });
        }
      }
      if (spec.rule) {
        const rx = left - (spec.indent ?? 0) + 2;
        page.push({ kind: "line", x1: rx, y1: y, x2: rx, y2: y + spec.leading, width: 1.5, color: [0.71, 0.51, 0.21] });
      }
      y += spec.leading;
      atTop = false;
    });
    y += spec.after;
  });

  if (options.footer !== undefined) {
    const total = pages.length;
    const fy = g.height - g.margin.bottom / 2;
    pages.forEach((page, i) => {
      const counter = `${i + 1} / ${total}`;
      const size = 8.5;
      const color: Rgb = [0.49, 0.47, 0.47];
      const cw = measure(counter, "sans", size);
      page.ops.push({ kind: "line", x1: g.margin.left, y1: fy - 14, x2: g.margin.left + contentWidth, y2: fy - 14, width: 0.5, color: [0.8, 0.79, 0.78] });
      if (options.footer) page.ops.push({ kind: "text", x: g.margin.left, y: fy, text: options.footer, font: "sans", size, color });
      page.ops.push({ kind: "text", x: g.width - g.margin.right - cw, y: fy, text: counter, font: "sans", size, color });
    });
  }

  return pages;
}

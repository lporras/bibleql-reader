import type { FontKey, PdfPage, Rgb } from "./writer";

// Flows styled blocks onto pages: greedy word wrap, page breaks, list
// markers, block-quote rules and a footer. Pure — text measurement is
// injected, so the browser passes a canvas-backed measure (lib/pdf/
// studyPdf.ts) and the tests pass a fixed-width one.

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type BlockStyle = "title" | "meta" | "h2" | "h3" | "body" | "quote" | "section" | "reference" | "scripture" | "why";

export interface Block {
  style: BlockStyle;
  runs: Run[];
  /** List nesting depth (0 = not in a list). */
  depth?: number;
  /** "•" or "3." — drawn in the gutter left of the first line. */
  marker?: string;
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
  why: { family: "serif", size: 10, leading: 14, before: 0, after: 6, color: MUTED, italic: true, indent: 10, rule: true }
};

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
  space: boolean;
  newline: boolean;
}

// HTML whitespace semantics: runs of spaces collapse to one, "\n" (a <br>)
// is a hard break.
function tokenize(runs: Run[], spec: StyleSpec): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    const font = fontFor(spec.family, !!(spec.bold || run.bold), !!(spec.italic || run.italic));
    for (const part of run.text.split(/(\n|[ \u00a0]+)/)) {
      if (!part) continue;
      if (part === "\n") tokens.push({ text: "", font, space: false, newline: true });
      else if (/^[ \u00a0]+$/.test(part)) {
        const prev = tokens[tokens.length - 1];
        if (prev && !prev.space && !prev.newline) tokens.push({ text: " ", font, space: true, newline: false });
      } else tokens.push({ text: part, font, space: false, newline: false });
    }
  }
  return tokens;
}

interface Segment {
  text: string;
  font: FontKey;
  x: number;
}

/** Greedy wrap into lines of positioned segments (x relative to the line start). */
export function wrap(runs: Run[], style: BlockStyle, maxWidth: number, measure: Measure): Segment[][] {
  const spec = STYLES[style];
  const lines: Segment[][] = [];
  let line: Segment[] = [];
  let x = 0;
  let pendingSpace: Token | null = null;

  function push(text: string, font: FontKey): void {
    const last = line[line.length - 1];
    if (last && last.font === font) last.text += text;
    else line.push({ text, font, x });
    x += measure(text, font, spec.size);
  }

  function breakLine(): void {
    lines.push(line);
    line = [];
    x = 0;
    pendingSpace = null;
  }

  for (const token of tokenize(runs, spec)) {
    if (token.newline) {
      breakLine();
      continue;
    }
    if (token.space) {
      if (line.length) pendingSpace = token;
      continue;
    }
    const spaceWidth = pendingSpace ? measure(" ", pendingSpace.font, spec.size) : 0;
    let width = measure(token.text, token.font, spec.size);
    if (line.length && x + spaceWidth + width > maxWidth) breakLine();
    else if (pendingSpace) push(" ", pendingSpace.font);
    pendingSpace = null;

    // A single word wider than the line (a URL, say) is split by character.
    let word = token.text;
    while (width > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && measure(word.slice(0, cut), token.font, spec.size) > maxWidth - x) cut--;
      push(word.slice(0, cut), token.font);
      breakLine();
      word = word.slice(cut);
      width = measure(word, token.font, spec.size);
    }
    push(word, token.font);
  }
  if (line.length || !lines.length) lines.push(line);
  return lines;
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
    const lines = wrap(block.runs, block.style, (g.width - g.margin.right - left) * WRAP_SLACK, measure);
    if (lines.length === 1 && !lines[0].length && !block.marker) {
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

    lines.forEach((segments, i) => {
      if (y + spec.leading > bottom) newPage();
      const baseline = y + spec.size;
      const page = pages[pages.length - 1].ops;
      if (i === 0 && block.marker) {
        const font = fontFor(spec.family, false, false);
        const w = measure(block.marker, font, spec.size);
        page.push({ kind: "text", x: left - 6 - w, y: baseline, text: block.marker, font, size: spec.size, color: spec.color });
      }
      for (const seg of segments) {
        page.push({ kind: "text", x: left + seg.x, y: baseline, text: seg.text, font: seg.font, size: spec.size, color: spec.color });
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

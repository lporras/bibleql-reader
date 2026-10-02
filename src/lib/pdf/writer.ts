import { pdfLiteral } from "./winAnsi";

// A minimal PDF 1.4 writer: text in the standard 14 fonts and straight
// lines, nothing else — which is all a study handout needs. No compression,
// no embedded fonts; every byte written is ASCII (pdfLiteral escapes the
// rest), so string offsets are byte offsets for the xref table.

export const FONTS = {
  serif: "Times-Roman",
  "serif-bold": "Times-Bold",
  "serif-italic": "Times-Italic",
  "serif-bolditalic": "Times-BoldItalic",
  sans: "Helvetica",
  "sans-bold": "Helvetica-Bold"
} as const;

export type FontKey = keyof typeof FONTS;

/** 0–1 per channel. */
export type Rgb = [number, number, number];

export interface TextOp {
  kind: "text";
  /** Points from the left edge / from the TOP edge (flipped on write). */
  x: number;
  y: number;
  text: string;
  font: FontKey;
  size: number;
  color: Rgb;
}

export interface LineOp {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: Rgb;
}

export type DrawOp = TextOp | LineOp;

export interface PdfPage {
  ops: DrawOp[];
}

export interface PdfDocument {
  width: number;
  height: number;
  pages: PdfPage[];
  title: string;
}

const FONT_KEYS = Object.keys(FONTS) as FontKey[];

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function rgb(c: Rgb): string {
  return c.map((v) => num(Math.round(v * 1000) / 1000)).join(" ");
}

// Info-dictionary strings may hold any Unicode as UTF-16BE with a BOM; hex
// keeps the file ASCII.
function utf16Hex(text: string): string {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

function contentStream(page: PdfPage, height: number): string {
  const out: string[] = [];
  for (const op of page.ops) {
    if (op.kind === "text") {
      const f = FONT_KEYS.indexOf(op.font) + 1;
      out.push(`BT /F${f} ${num(op.size)} Tf ${rgb(op.color)} rg ${num(op.x)} ${num(height - op.y)} Td (${pdfLiteral(op.text)}) Tj ET`);
    } else {
      out.push(
        `${num(op.width)} w ${rgb(op.color)} RG ${num(op.x1)} ${num(height - op.y1)} m ${num(op.x2)} ${num(height - op.y2)} l S`
      );
    }
  }
  return out.join("\n");
}

export function writePdf(doc: PdfDocument): Uint8Array {
  // Object numbers: 1 catalog, 2 pages, 3 info, then one per font, then a
  // (content, page) pair per page.
  const fontBase = 4;
  const pageBase = fontBase + FONT_KEYS.length;
  const bodies: string[] = [];
  const pageRefs = doc.pages.map((_, i) => `${pageBase + i * 2 + 1} 0 R`);

  bodies.push("<< /Type /Catalog /Pages 2 0 R >>");
  bodies.push(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${doc.pages.length} >>`);
  bodies.push(`<< /Title ${utf16Hex(doc.title)} /Producer (BibleQL Reader) >>`);
  for (const key of FONT_KEYS) {
    bodies.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[key]} /Encoding /WinAnsiEncoding >>`);
  }
  const fontDict = FONT_KEYS.map((_, i) => `/F${i + 1} ${fontBase + i} 0 R`).join(" ");
  doc.pages.forEach((page, i) => {
    const stream = contentStream(page, doc.height);
    bodies.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    bodies.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(doc.width)} ${num(doc.height)}] ` +
        `/Resources << /Font << ${fontDict} >> >> /Contents ${pageBase + i * 2} 0 R >>`
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  bodies.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}

import { pdfLiteral } from "./winAnsi";

// A minimal PDF 1.4 writer: text in the standard 14 fonts, straight lines,
// JPEG images and link areas — which is all a study handout needs. No
// compression, no embedded fonts. The file is built as a string of one char
// per byte (text is ASCII — pdfLiteral escapes the rest — and JPEG data is
// copied in byte for byte), so string offsets are byte offsets for the xref
// table.

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
  /** Extra points after each space (justified lines) — PDF's Tw. */
  wordSpacing?: number;
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

export interface ImageOp {
  kind: "image";
  /** Top-left corner, from the left / TOP edge, and the drawn size, in points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Index into PdfDocument.images. */
  image: number;
}

/** A clickable area that opens a URL. Not drawn — the text under it is. */
export interface LinkOp {
  kind: "link";
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
}

export type DrawOp = TextOp | LineOp | ImageOp | LinkOp;

export interface PdfPage {
  ops: DrawOp[];
}

/** A baseline JPEG (what canvas.toBlob("image/jpeg") writes), RGB. */
export interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface PdfDocument {
  width: number;
  height: number;
  pages: PdfPage[];
  title: string;
  images?: PdfImage[];
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
      // Tw is graphics state and outlives ET, so a justified line resets it.
      const ws = op.wordSpacing ? [`${num(op.wordSpacing)} Tw `, " 0 Tw"] : ["", ""];
      out.push(
        `BT /F${f} ${num(op.size)} Tf ${rgb(op.color)} rg ${ws[0]}${num(op.x)} ${num(height - op.y)} Td (${pdfLiteral(op.text)}) Tj${ws[1]} ET`
      );
    } else if (op.kind === "line") {
      out.push(
        `${num(op.width)} w ${rgb(op.color)} RG ${num(op.x1)} ${num(height - op.y1)} m ${num(op.x2)} ${num(height - op.y2)} l S`
      );
    } else if (op.kind === "image") {
      out.push(`q ${num(op.width)} 0 0 ${num(op.height)} ${num(op.x)} ${num(height - op.y - op.height)} cm /Im${op.image + 1} Do Q`);
    }
  }
  return out.join("\n");
}

function binary(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

function linkAnnotation(op: LinkOp, height: number): string {
  const rect = [op.x, height - op.y - op.height, op.x + op.width, height - op.y].map(num).join(" ");
  return `<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI (${pdfLiteral(op.href)}) >> >>`;
}

export function writePdf(doc: PdfDocument): Uint8Array {
  // Object numbers: 1 catalog, 2 pages, 3 info, then the fonts, the images,
  // and per page its link annotations, content stream and page object.
  const bodies: string[] = [];
  const add = (body: string): number => bodies.push(body);

  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // the page tree, filled in once the page objects are numbered
  add(`<< /Title ${utf16Hex(doc.title)} /Producer (BibleQL Reader) >>`);
  const fontDict = FONT_KEYS.map(
    (key, i) => `/F${i + 1} ${add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[key]} /Encoding /WinAnsiEncoding >>`)} 0 R`
  ).join(" ");
  const imageDict = (doc.images ?? [])
    .map((img, i) => {
      const obj = add(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n${binary(img.data)}\nendstream`
      );
      return `/Im${i + 1} ${obj} 0 R`;
    })
    .join(" ");
  const resources = `<< /Font << ${fontDict} >>${imageDict ? ` /XObject << ${imageDict} >>` : ""} >>`;

  const pageObjs = doc.pages.map((page) => {
    const annots = page.ops
      .filter((op): op is LinkOp => op.kind === "link")
      .map((op) => `${add(linkAnnotation(op, doc.height))} 0 R`);
    const stream = contentStream(page, doc.height);
    const contents = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(doc.width)} ${num(doc.height)}] ` +
        `/Resources ${resources} /Contents ${contents} 0 R${annots.length ? ` /Annots [${annots.join(" ")}]` : ""} >>`
    );
  });
  bodies[1] = `<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(" ")}] /Count ${doc.pages.length} >>`;

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

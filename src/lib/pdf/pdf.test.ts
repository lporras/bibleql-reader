import { describe, it, expect } from "vitest";
import { pdfLiteral, toWinAnsiText } from "./winAnsi";
import { layoutBlocks, wrap, type Block, type Measure } from "./layout";
import { writePdf, type TextOp } from "./writer";
import { studyPdfFilename } from "./studyPdf";

// Every glyph is 0.5em wide: easy to reason about, and no canvas needed.
const measure: Measure = (text, _font, size) => text.length * size * 0.5;

const decoder = new TextDecoder("latin1");

describe("WinAnsi text", () => {
  it("keeps Spanish and typographic punctuation, folds the rest", () => {
    expect(toWinAnsiText("¿Dónde está? «Señor» — “gracia”…")).toBe("¿Dónde está? «Señor» — “gracia”…");
    expect(toWinAnsiText("Ŝalom ἀγάπη")).toBe("Salom ?????");
  });

  it("prints verse-text line breaks and odd spaces as spaces, never as ?", () => {
    expect(toWinAnsiText("him,\n“Most\u2009certainly,\n\nhe\u200b")).toBe("him, “Most certainly,  he");
  });

  it("escapes PDF delimiters and writes high bytes as octal", () => {
    expect(pdfLiteral("(a\\b)")).toBe("\\(a\\\\b\\)");
    expect(pdfLiteral("ñ—")).toBe("\\361\\227");
  });
});

describe("wrap", () => {
  it("breaks greedily on spaces within the width", () => {
    // size 10 -> 5pt per char; 50pt fits 10 chars.
    const lines = wrap([{ text: "aaaa bbbb cccc" }], "body", 50, (t) => t.length * 5);
    expect(lines.map((l) => l.map((s) => s.text).join(""))).toEqual(["aaaa bbbb", "cccc"]);
  });

  it("splits a word longer than the line", () => {
    const lines = wrap([{ text: "abcdefghijkl" }], "body", 25, (t) => t.length * 5);
    expect(lines.map((l) => l.map((s) => s.text).join(""))).toEqual(["abcde", "fghij", "kl"]);
  });

  it("keeps bold and plain runs as separate positioned segments", () => {
    const [line] = wrap([{ text: "For " }, { text: "God", bold: true }, { text: " so" }], "body", 500, (t) => t.length * 5);
    expect(line.map((s) => [s.text, s.font, s.x])).toEqual([
      ["For ", "serif", 0],
      ["God", "serif-bold", 20],
      [" so", "serif", 35]
    ]);
  });

  it("treats a newline as a hard break", () => {
    const lines = wrap([{ text: "one\ntwo" }], "body", 500, measure);
    expect(lines).toHaveLength(2);
  });
});

describe("layoutBlocks", () => {
  const para = (n: number): Block => ({ style: "body", runs: [{ text: `Paragraph ${n} `.repeat(30) }] });

  it("flows long content onto more pages and numbers them", () => {
    const pages = layoutBlocks(Array.from({ length: 30 }, (_, i) => para(i)), measure, { footer: "Grace" });
    expect(pages.length).toBeGreaterThan(1);
    const last = pages[pages.length - 1].ops.filter((op): op is TextOp => op.kind === "text").map((op) => op.text);
    expect(last).toContain(`${pages.length} / ${pages.length}`);
    expect(last).toContain("Grace");
  });

  it("never leaves text below the bottom margin", () => {
    const pages = layoutBlocks(Array.from({ length: 30 }, (_, i) => para(i)), measure);
    for (const page of pages) {
      for (const op of page.ops) if (op.kind === "text") expect(op.y).toBeLessThanOrEqual(792 - 72);
    }
  });

  it("draws a list marker in the gutter", () => {
    const [page] = layoutBlocks([{ style: "body", runs: [{ text: "Repent" }], depth: 1, marker: "1." }], measure);
    const texts = page.ops.filter((op): op is TextOp => op.kind === "text");
    const marker = texts.find((op) => op.text === "1.")!;
    const item = texts.find((op) => op.text === "Repent")!;
    expect(marker.x).toBeLessThan(item.x);
    expect(marker.y).toBe(item.y);
  });
});

describe("layoutBlocks: alignment, links, rules, images", () => {
  // 0.5em glyphs at 11.5pt body size -> 5.75pt per char; the column is 468pt.
  const texts = (block: Block) =>
    layoutBlocks([block], measure)[0].ops.filter((op): op is TextOp => op.kind === "text");

  it("centers and right-aligns a short line in the column", () => {
    const width = "Amen".length * 5.75;
    expect(texts({ style: "body", runs: [{ text: "Amen" }], align: "center" })[0].x).toBeCloseTo(72 + (468 - width) / 2);
    expect(texts({ style: "body", runs: [{ text: "Amen" }], align: "right" })[0].x).toBeCloseTo(72 + 468 - width);
  });

  it("justifies every line but the last with word spacing", () => {
    const ops = texts({ style: "body", runs: [{ text: "grace and peace ".repeat(20) }], align: "justify" });
    const lines = [...new Set(ops.map((op) => op.y))];
    expect(lines.length).toBeGreaterThan(1);
    const first = ops.filter((op) => op.y === lines[0]);
    const last = ops.filter((op) => op.y === lines[lines.length - 1]);
    expect(first.every((op) => (op.wordSpacing ?? 0) > 0)).toBe(true);
    expect(last.every((op) => !op.wordSpacing)).toBe(true);
  });

  it("makes a link run clickable over exactly its text", () => {
    const [page] = layoutBlocks([{ style: "body", runs: [{ text: "See " }, { text: "bibleql.org", href: "https://bibleql.org/" }] }], measure);
    const link = page.ops.find((op) => op.kind === "link");
    const text = page.ops.find((op): op is TextOp => op.kind === "text" && op.text === "bibleql.org");
    expect(link).toMatchObject({ href: "https://bibleql.org/", x: text!.x, width: "bibleql.org".length * 5.75 });
  });

  it("draws a divider across the column", () => {
    const [page] = layoutBlocks([{ style: "rule", runs: [] }], measure);
    expect(page.ops).toEqual([expect.objectContaining({ kind: "line", x1: 72, x2: 540 })]);
  });

  it("fits a large image to the column, centered, and moves it to a new page if it can't fit", () => {
    const image: Block = { style: "image", runs: [], image: { index: 0, width: 2000, height: 1000 } };
    const [page] = layoutBlocks([image], measure);
    expect(page.ops[0]).toMatchObject({ kind: "image", x: 72, width: 468, height: 234 });

    const small: Block = { style: "image", runs: [], image: { index: 0, width: 400, height: 300 } };
    expect(layoutBlocks([small], measure)[0].ops[0]).toMatchObject({ x: 72 + (468 - 300) / 2, width: 300, height: 225 });

    const filler = Array.from({ length: 20 }, (): Block => ({ style: "body", runs: [{ text: "line" }] }));
    const pages = layoutBlocks([...filler, image], measure);
    expect(pages).toHaveLength(2);
    expect(pages[1].ops[0]).toMatchObject({ kind: "image", y: 72 });
  });
});

describe("writePdf", () => {
  it("writes a well-formed file whose xref offsets point at their objects", () => {
    const pages = layoutBlocks([{ style: "title", runs: [{ text: "Gracia (y paz)" }] }], measure, { footer: "x" });
    const pdf = decoder.decode(writePdf({ width: 612, height: 792, pages, title: "Gracia ✝" }));

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("(Gracia \\(y paz\\)) Tj");

    const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((off, i) => expect(pdf.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));

    // Stream lengths must match their content exactly.
    for (const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      expect(pdf.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe("\nendstream");
    }
  });
});

describe("writePdf: images and links", () => {
  it("embeds JPEG bytes verbatim and references them from the page", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x80, 0xff, 0xd9]);
    const pages = [
      {
        ops: [
          { kind: "image" as const, x: 72, y: 72, width: 100, height: 50, image: 0 },
          { kind: "link" as const, x: 72, y: 200, width: 40, height: 16, href: "https://bibleql.org/" }
        ]
      }
    ];
    const bytes = writePdf({ width: 612, height: 792, pages, title: "x", images: [{ data: jpeg, width: 4, height: 2 }] });
    const pdf = decoder.decode(bytes);

    expect(pdf).toContain("/Subtype /Image /Width 4 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 7");
    const at = pdf.indexOf("stream\n\u00ff\u00d8") + "stream\n".length;
    expect(Array.from(bytes.slice(at, at + 7))).toEqual(Array.from(jpeg));
    expect(pdf).toContain("/XObject << /Im1 ");
    expect(pdf).toContain("q 100 0 0 50 72 670 cm /Im1 Do Q");
    expect(pdf).toMatch(/\/Annots \[\d+ 0 R\]/);
    expect(pdf).toContain("/Rect [72 576 112 592] /Border [0 0 0] /A << /S /URI /URI (https://bibleql.org/) >>");

    const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((off, i) => expect(pdf.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});

describe("studyPdfFilename", () => {
  it("keeps accented letters and drops path-hostile characters", () => {
    expect(studyPdfFilename("  La gracia: ¿qué es?  ", "Estudio")).toBe("La-gracia-¿qué-es.pdf");
    expect(studyPdfFilename("", "Untitled study")).toBe("Untitled-study.pdf");
    expect(studyPdfFilename("///", "x")).toBe("study.pdf");
  });
});

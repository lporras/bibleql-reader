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

describe("studyPdfFilename", () => {
  it("keeps accented letters and drops path-hostile characters", () => {
    expect(studyPdfFilename("  La gracia: ¿qué es?  ", "Estudio")).toBe("La-gracia-¿qué-es.pdf");
    expect(studyPdfFilename("", "Untitled study")).toBe("Untitled-study.pdf");
    expect(studyPdfFilename("///", "x")).toBe("study.pdf");
  });
});

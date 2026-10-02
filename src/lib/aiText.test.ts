import { describe, it, expect } from "vitest";
import { parseAiText, parseInlines, type AiBlock } from "./aiText";

/** Blocks as plain strings, emphasis marked back up, for readable expectations. */
function flat(blocks: AiBlock[]): string[] {
  const line = (inlines: { text: string; bold?: boolean; italic?: boolean }[]) =>
    inlines.map((i) => (i.bold ? `<b>${i.text}</b>` : i.italic ? `<i>${i.text}</i>` : i.text)).join("");
  return blocks.flatMap((b) =>
    b.kind === "p" ? [line(b.inlines)] : b.items.map((item, n) => `${b.kind === "ol" ? `${b.start + n}.` : "-"} ${line(item)}`)
  );
}

describe("parseAiText", () => {
  it("keeps paragraphs apart", () => {
    const blocks = parseAiText("Peter asked how often.\n\nJesus answered: seventy times seven.");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "p"]);
  });

  it("restores the space a sentence lost after its full stop", () => {
    expect(flat(parseAiText("He forgave.Peter learned!Then:Grace"))).toEqual(["He forgave. Peter learned! Then: Grace"]);
  });

  it("leaves references, abbreviations and decimals alone", () => {
    const text = "See Juan 3:16 and Rom. 5:8, e.g.Faith; U.S. and 2.5 stay.";
    expect(flat(parseAiText(text))).toEqual([text]);
  });

  it("reads Markdown lists, numbered and bulleted", () => {
    const blocks = parseAiText("Three points:\n1. Grace\n2. Faith\n\n- **Mercy** first\n- *then* peace");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ol", "ul"]);
    expect(flat(blocks)).toEqual(["Three points:", "1. Grace", "2. Faith", "- <b>Mercy</b> first", "- <i>then</i> peace"]);
  });

  it("breaks an outline run together on one line", () => {
    expect(flat(parseAiText("Outline: 1. The call (Matt 4:19) 2. The cost 3. The reward."))).toEqual([
      "Outline:",
      "1. The call (Matt 4:19)",
      "2. The cost",
      "3. The reward."
    ]);
  });

  it("doesn't mistake a stray number for a list", () => {
    expect(flat(parseAiText("Chapter 2. Then more in chapter 3."))).toEqual(["Chapter 2. Then more in chapter 3."]);
  });

  it("turns a Markdown heading into a bold line, and a double-escaped newline into a break", () => {
    expect(flat(parseAiText("## Forgiveness\\nIt is commanded."))).toEqual(["<b>Forgiveness</b>", "It is commanded."]);
  });
});

describe("parseInlines", () => {
  it("doesn't read a lone asterisk or snake_case as emphasis", () => {
    expect(parseInlines("5 * 7 and some_word_here")).toEqual([{ text: "5 * 7 and some_word_here" }]);
  });
});

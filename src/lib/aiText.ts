// The assistant's answer text -> paragraphs and lists to render. Pure, so
// it's unit-tested directly (aiText.test.ts).
//
// The model is asked for plain paragraphs and "-" / "1." lists (lib/ai.ts),
// but what comes back varies: Markdown emphasis, an outline run together
// on one line ("1. Grace 2. Faith 3. Works"), or sentences with the space
// after the full stop missing ("forgiven.Peter"). Rendered verbatim, that
// read as one wall of joined-up text. This reads all of those, and
// produces only text and emphasis — never HTML — so nothing in an answer
// can inject markup.

export interface AiInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type AiBlock =
  | { kind: "p"; inlines: AiInline[] }
  | { kind: "ul"; items: AiInline[][] }
  | { kind: "ol"; start: number; items: AiInline[][] };

const BULLET = /^\s*(?:[-*•‣–]|•)\s+/;
const NUMBER = /^\s*(\d{1,2})[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;

/** "forgiven.Peter" -> "forgiven. Peter"; leaves "3:16", "e.g." and "U.S." alone. */
function spaceSentences(text: string): string {
  return text.replace(/(\p{Ll}{2}|\p{Ll}[)"”’»])([.!?;:])(?=[\p{Lu}¿¡“«])/gu, "$1$2 ");
}

/**
 * Breaks an outline written on one line onto its own lines — but only a
 * real sequence (1., 2., 3. in order), so "John 3. 16" or a lone "2." in a
 * sentence stays put. Bullets get the same treatment when there are two.
 */
function breakInlineLists(line: string): string {
  const numbers = [...line.matchAll(/(^|\s)(\d{1,2})[.)]\s+(?=\S)/g)];
  const first = numbers.findIndex((m) => m[2] === "1");
  if (first !== -1) {
    const run = [numbers[first]];
    for (const m of numbers.slice(first + 1)) if (Number(m[2]) === run.length + 1) run.push(m);
    if (run.length >= 2) {
      let out = "";
      let at = 0;
      for (const m of run) {
        const start = m.index! + m[1].length;
        out += line.slice(at, start).trimEnd() + (start > 0 ? "\n" : "");
        at = start;
      }
      return out + line.slice(at);
    }
  }
  const bullets = line.split(/\s+•\s+/);
  return bullets.length > 2 ? bullets.map((b, i) => (i > 0 ? `• ${b}` : b)).join("\n") : line;
}

/** **bold**, __bold__, *italic*, _italic_ — the emphasis Markdown the model uses. */
export function parseInlines(text: string): AiInline[] {
  const out: AiInline[] = [];
  const re = /\*\*(.+?)\*\*|__(.+?)__|(?<![\p{L}\d*])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\d*])|(?<![\p{L}\d_])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\d_])/gu;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > at) out.push({ text: text.slice(at, m.index) });
    if (m[1] ?? m[2]) out.push({ text: (m[1] ?? m[2])!, bold: true });
    else out.push({ text: (m[3] ?? m[4])!, italic: true });
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out.filter((i) => i.text);
}

export function parseAiText(raw: string): AiBlock[] {
  const text = spaceSentences(
    raw
      .replace(/\r\n?/g, "\n")
      // A double-escaped newline inside the JSON answer arrives as "\n" text.
      .replace(/\\n/g, "\n")
  );
  const lines = text.split("\n").flatMap((line) => breakInlineLists(line).split("\n"));

  const blocks: AiBlock[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const bullet = line.match(BULLET);
    const number = line.match(NUMBER);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      const item = parseInlines(line.slice(bullet[0].length).trim());
      if (last?.kind === "ul") last.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
    } else if (number) {
      const item = parseInlines(line.slice(number[0].length).trim());
      if (last?.kind === "ol") last.items.push(item);
      else blocks.push({ kind: "ol", start: Number(number[1]), items: [item] });
    } else if (HEADING.test(line)) {
      // Headings are too loud in a chat bubble; a bold line reads as one.
      blocks.push({ kind: "p", inlines: [{ text: line.replace(HEADING, "").replace(/\*\*/g, "").trim(), bold: true }] });
    } else {
      // Each line is its own paragraph: the model uses single newlines as breaks.
      blocks.push({ kind: "p", inlines: parseInlines(line.trim()) });
    }
  }
  return blocks;
}

// The PDF uses the standard 14 fonts (Times, Helvetica), which need no font
// file embedded — but they only cover WinAnsiEncoding (Windows-1252). That
// is all of Latin-1 (every Spanish letter, ¿ ¡ « ») plus typographic quotes,
// dashes, the ellipsis and the bullet, which is what Bible text and sermon
// notes in English and Spanish actually use. Anything else degrades to its
// unaccented letter, or "?".

// Windows-1252's 0x80–0x9F block, where it differs from Latin-1.
const CP1252_EXTRAS: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f
};

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
// Line breaks inside verse text (the WEB marks poetry lines with "\n"),
// tabs and the Unicode spaces print as plain spaces; zero-width characters
// are dropped. Hard breaks the editor meant are "\n" runs that layout.ts
// splits on before any text reaches here.
const SEPARATORS = new RegExp("[\\t\\n\\r\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]", "g");
const ZERO_WIDTH = new RegExp("[\\u200b-\\u200d\\u2060\\ufeff]", "g");

/** The WinAnsi byte for one character, or null if it has none. */
export function winAnsiCode(ch: string): number | null {
  const extra = CP1252_EXTRAS[ch];
  if (extra !== undefined) return extra;
  const code = ch.codePointAt(0) ?? 0;
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
  return null;
}

/**
 * Rewrites `text` so every character has a WinAnsi byte. Run it before
 * measuring as well as before writing, so the widths laid out are the
 * widths of what actually gets printed.
 */
export function toWinAnsiText(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC").replace(ZERO_WIDTH, "").replace(SEPARATORS, " ")) {
    if (winAnsiCode(ch) !== null) {
      out += ch;
      continue;
    }
    const base = ch.normalize("NFD").replace(COMBINING_MARKS, "");
    out += base && [...base].every((c) => winAnsiCode(c) !== null) ? base : "?";
  }
  return out;
}

/** A PDF literal string body: ASCII only, with ( ) \ escaped and high bytes as octal. */
export function pdfLiteral(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = winAnsiCode(ch) ?? 0x3f;
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${ch}`;
    else if (code < 0x80) out += ch;
    else out += `\\${code.toString(8).padStart(3, "0")}`;
  }
  return out;
}

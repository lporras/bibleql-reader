import { bookLabel } from "../../../lib/refs";
import { formatVerseList } from "../../../lib/verseRanges";
import type { Locale } from "../../../data/strings";
import type { Verse } from "../../../types/bible";

/**
 * Builds the display text for a scripture element from structured passage
 * data — never from a pre-formatted string handed across a boundary (spec
 * §12), so translation/verse changes can regenerate it later without
 * re-parsing anything.
 */
export function buildScriptureText(allVerses: Verse[], selectedVerses: number[]): string {
  const wanted = new Set(selectedVerses);
  return allVerses
    .filter((v) => wanted.has(v.verse))
    .map((v) => v.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "John 3:16-17, 20" / "Juan 3:16-17, 20" — book name follows the locale. */
export function buildReference(bookId: string, chapter: number, verses: number[], locale: Locale): string {
  return `${bookLabel(bookId, locale)} ${chapter}:${formatVerseList(verses)}`;
}

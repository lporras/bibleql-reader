// Per-verse marks the reader makes: a favorite flag, a highlight color, and a
// free-text note. All three live on one record per verse so a verse that is
// favorited, highlighted and annotated is still a single entry.
//
// Marks are deliberately translation-independent — the key is book/chapter/verse
// only. Deuteronomy 6:6 stays marked whichever translation (or which side of
// compare mode) you are reading it in.

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "purple", "pink", "orange", "teal", "gray"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export interface VerseRef {
  bookId: string;
  chapter: number;
  verse: number;
}

export interface VerseAnnotation extends VerseRef {
  favorite: boolean;
  color: HighlightColor | null;
  note: string;
  updatedAt: number;
}

export type AnnotationMap = Record<string, VerseAnnotation>;

export function verseKey(ref: VerseRef): string {
  return `${ref.bookId}.${ref.chapter}.${ref.verse}`;
}

// A record with none of the three marks left on it is dropped rather than kept
// as an empty row, so the store never accumulates tombstones.
export function isEmptyAnnotation(a: VerseAnnotation): boolean {
  return !a.favorite && a.color === null && a.note.trim() === "";
}

import { BOOKS } from "../data/books";
import type { Locale } from "../data/strings";
import type { Book } from "../types/bible";

export function findBook(bookId: string): Book {
  return BOOKS.find((b) => b.id === bookId) ?? BOOKS[0];
}

export function bookLabel(bookId: string, locale: Locale): string {
  const book = findBook(bookId);
  return locale === "es" ? book.nameEs : book.nameEn;
}

// Reference must be written in the translation's own language —
// BibleQL's `passage(reference:)` argument expects it that way.
export function refFor(translationId: string, bookId: string, chapter: number): string {
  const book = findBook(bookId);
  const name = translationId.slice(0, 3) === "spa" ? book.nameEs : book.nameEn;
  return `${name} ${chapter}`;
}

export interface ParsedRef {
  bookId: string;
  chapter: number;
  from: number | null;
  to: number | null;
}

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "John 3:16" / "1 Corintios 15:20-23" / "Juan 3" -> book, chapter, verse range
export function parseRef(text: string): ParsedRef | null {
  const m = String(text)
    .trim()
    .match(/^(.+?)\s+(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?/);
  if (!m) return null;

  const q = normalize(m[1]);
  const hit =
    BOOKS.find((b) => normalize(b.nameEn) === q || normalize(b.nameEs) === q || b.id.toLowerCase() === q) ??
    BOOKS.find((b) => normalize(b.nameEn).indexOf(q) === 0 || normalize(b.nameEs).indexOf(q) === 0);
  if (!hit) return null;

  return {
    bookId: hit.id,
    chapter: Math.min(Math.max(parseInt(m[2], 10) || 1, 1), hit.chapters),
    from: m[3] ? parseInt(m[3], 10) : null,
    to: m[4] ? parseInt(m[4], 10) : null
  };
}

export interface StepResult {
  bookId: string;
  chapter: number;
}

// Prev/Next chapter stepping, rolling over into the adjacent book at chapter boundaries.
export function stepChapter(bookId: string, chapter: number, dir: 1 | -1): StepResult | null {
  const i = BOOKS.findIndex((b) => b.id === bookId);
  if (i === -1) return null;
  const current = BOOKS[i];
  const ch = chapter + dir;
  if (ch >= 1 && ch <= current.chapters) return { bookId, chapter: ch };

  const j = i + dir;
  if (j < 0 || j >= BOOKS.length) return null;
  return { bookId: BOOKS[j].id, chapter: dir > 0 ? 1 : BOOKS[j].chapters };
}

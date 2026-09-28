export interface Book {
  id: string;
  nameEn: string;
  nameEs: string;
  chapters: number;
}

export interface Verse {
  verse: number;
  text: string;
}

export interface PassageResult {
  reference: string;
  translationName: string;
  translationNote: string;
  verses: Verse[];
}

export interface TranslationSummary {
  identifier: string;
  name: string;
  language: string;
  note: string;
  concordanceIndexedAt: string | null;
}

export interface ConcordanceEntry {
  surfaceForms: string[];
  totalOccurrences: number;
  verseCount: number;
  occurrencesByTestament: { old: number; new: number };
}

export interface ConcordanceVerseRef {
  bookName: string;
  chapter: number;
  verse: number;
}

export interface ConcordanceHitNode {
  context: string;
  verse: ConcordanceVerseRef;
}

export interface ConcordancePage {
  totalCount: number;
  entry: ConcordanceEntry | null;
  edges: { node: ConcordanceHitNode }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export interface SearchHit {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}

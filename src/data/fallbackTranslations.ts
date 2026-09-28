import type { TranslationSummary } from "../types/bible";

// Shown in the translation pickers before a real `translations` list has
// loaded (or when it fails to load) — a small hand-picked shortlist,
// not BibleQL's full catalog.
export const FALLBACK_TRANSLATIONS: TranslationSummary[] = [
  { identifier: "eng-web", name: "World English Bible", language: "en", note: "", concordanceIndexedAt: null },
  { identifier: "eng-kjv", name: "King James Version", language: "en", note: "", concordanceIndexedAt: null },
  { identifier: "eng-asv", name: "American Standard Version", language: "en", note: "", concordanceIndexedAt: null },
  { identifier: "spa-rv1909", name: "Reina Valera 1909", language: "es", note: "", concordanceIndexedAt: null },
  { identifier: "spa-bes", name: "Biblia en Español Sencillo", language: "es", note: "", concordanceIndexedAt: null },
  { identifier: "spa-vbl", name: "Versión Biblia Libre", language: "es", note: "", concordanceIndexedAt: null }
];

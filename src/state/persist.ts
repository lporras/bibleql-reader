import type { Theme } from "../types/app";
import type { Locale } from "../data/strings";

export interface PersistedPrefs {
  theme: Theme;
  locale: Locale;
  compare: boolean;
  panelOpen: boolean;
  transA: string;
  transB: string;
  bookId: string;
  chapter: number;
}

const PREFS_KEY = "biblereader.prefs";
const AI_KEY_KEY = "biblereader.aikey";

export function readPrefs(): Partial<PersistedPrefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

// Merges onto whatever is already stored so independent writers (app-wide
// preferences vs. the current reading location) don't clobber each other.
export function writePrefs(patch: Partial<PersistedPrefs>): void {
  try {
    const current = readPrefs();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // storage unavailable
  }
}

export function readAiKey(): string {
  try {
    return localStorage.getItem(AI_KEY_KEY) || "";
  } catch {
    return "";
  }
}

export function writeAiKey(key: string): void {
  try {
    localStorage.setItem(AI_KEY_KEY, key);
  } catch {
    // ignore
  }
}

export interface LastLocation {
  bookId: string;
  chapter: number;
}

export function readLastLocation(): LastLocation | null {
  const prefs = readPrefs();
  if (prefs.bookId && prefs.chapter) return { bookId: prefs.bookId, chapter: prefs.chapter };
  return null;
}

export function writeLastLocation(location: LastLocation): void {
  writePrefs(location);
}

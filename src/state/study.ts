import { bookLabel } from "../lib/refs";
import { formatVerseList } from "../lib/verseRanges";
import type { Locale } from "../data/strings";
import type { StudiesState, Study, StudyPassage } from "../types/study";

// Pure model for studies — the reducer StudiesContext runs and the helpers
// its callers share. Kept free of React and storage so it's unit-tested
// directly (study.test.ts). Ids and timestamps come in on the action rather
// than being generated here, which keeps every transition deterministic.

export type StudiesAction =
  | { type: "CREATE"; study: Study }
  | { type: "UPDATE"; id: string; patch: Partial<Pick<Study, "title" | "descriptionHtml">>; now: number }
  | { type: "DELETE"; id: string }
  | { type: "SET_ACTIVE"; id: string }
  | { type: "ADD_PASSAGES"; id: string; passages: StudyPassage[]; now: number }
  | { type: "REMOVE_PASSAGE"; id: string; passageId: string; now: number }
  | { type: "MOVE_PASSAGE"; id: string; passageId: string; dir: 1 | -1; now: number }
  | { type: "SET_PASSAGE_TEXT"; id: string; passageId: string; text: string };

export function emptyStudy(id: string, title: string, now: number): Study {
  return { id, title, descriptionHtml: "", passages: [], createdAt: now, updatedAt: now };
}

type PassageIdentity = Pick<StudyPassage, "bookId" | "chapter" | "verses" | "translationId">;

/**
 * Same book, chapter, verse set and translation — the identity "Add to
 * study" dedupes on. The translation is part of it on purpose: setting the
 * same verses side by side in two translations is a normal part of
 * preparing a sermon.
 */
export function samePassage(a: PassageIdentity, b: PassageIdentity): boolean {
  return (
    a.translationId === b.translationId &&
    a.bookId === b.bookId &&
    a.chapter === b.chapter &&
    a.verses.length === b.verses.length &&
    a.verses.every((v, i) => v === b.verses[i])
  );
}

export function hasPassage(study: Study | null, p: PassageIdentity): boolean {
  return !!study && study.passages.some((existing) => samePassage(existing, p));
}

/** "John 3:16-17, 20", or "Psalm 23" for a whole chapter. Follows the locale. */
export function passageReference(p: Pick<StudyPassage, "bookId" | "chapter" | "verses">, locale: Locale): string {
  const head = `${bookLabel(p.bookId, locale)} ${p.chapter}`;
  return p.verses.length ? `${head}:${formatVerseList(p.verses)}` : head;
}

/** A parsed "from"–"to" range (lib/refs parseRef) as a verse list. */
export function versesFromRange(from: number | null, to: number | null): number[] {
  if (from === null) return [];
  const end = to !== null && to >= from ? to : from;
  const out: number[] = [];
  for (let v = from; v <= end; v++) out.push(v);
  return out;
}

function touch(state: StudiesState, id: string, now: number, change: (study: Study) => Study): StudiesState {
  return {
    ...state,
    studies: state.studies.map((study) => (study.id === id ? { ...change(study), updatedAt: now } : study))
  };
}

export function studiesReducer(state: StudiesState, action: StudiesAction): StudiesState {
  switch (action.type) {
    case "CREATE":
      return { studies: [...state.studies, action.study], activeId: action.study.id };
    case "UPDATE":
      return touch(state, action.id, action.now, (study) => ({ ...study, ...action.patch }));
    case "DELETE": {
      const studies = state.studies.filter((study) => study.id !== action.id);
      if (state.activeId !== action.id) return { ...state, studies };
      // Fall back to the most recently edited study, so "Add to study" keeps
      // a sensible target instead of silently starting a new one.
      const next = [...studies].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      return { studies, activeId: next?.id ?? null };
    }
    case "SET_ACTIVE":
      return state.studies.some((study) => study.id === action.id) ? { ...state, activeId: action.id } : state;
    case "ADD_PASSAGES": {
      const target = state.studies.find((study) => study.id === action.id);
      if (!target) return state;
      const fresh: StudyPassage[] = [];
      for (const p of action.passages) {
        if (!hasPassage(target, p) && !fresh.some((q) => samePassage(q, p))) fresh.push(p);
      }
      if (!fresh.length) return state;
      return touch(state, action.id, action.now, (study) => ({ ...study, passages: [...study.passages, ...fresh] }));
    }
    case "REMOVE_PASSAGE":
      return touch(state, action.id, action.now, (study) => ({
        ...study,
        passages: study.passages.filter((p) => p.id !== action.passageId)
      }));
    case "MOVE_PASSAGE": {
      const target = state.studies.find((study) => study.id === action.id);
      const from = target?.passages.findIndex((p) => p.id === action.passageId) ?? -1;
      const to = from + action.dir;
      if (!target || from === -1 || to < 0 || to >= target.passages.length) return state;
      return touch(state, action.id, action.now, (study) => {
        const passages = [...study.passages];
        [passages[from], passages[to]] = [passages[to], passages[from]];
        return { ...study, passages };
      });
    }
    case "SET_PASSAGE_TEXT":
      // Backfilling fetched text isn't an edit, so it leaves updatedAt alone.
      return {
        ...state,
        studies: state.studies.map((study) =>
          study.id === action.id
            ? {
                ...study,
                passages: study.passages.map((p) => (p.id === action.passageId ? { ...p, text: action.text } : p))
              }
            : study
        )
      };
    default:
      return state;
  }
}

/** Newest edit first — the order every study list shows. */
export function byRecent(studies: Study[]): Study[] {
  return [...studies].sort((a, b) => b.updatedAt - a.updatedAt);
}

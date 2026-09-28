import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import {
  isEmptyAnnotation,
  verseKey,
  type AnnotationMap,
  type HighlightColor,
  type VerseAnnotation,
  type VerseRef
} from "../types/annotations";
import { readAnnotations, writeAnnotations } from "./persist";

type Action =
  | { type: "TOGGLE_FAVORITE"; refs: VerseRef[] }
  | { type: "SET_COLOR"; refs: VerseRef[]; color: HighlightColor | null }
  | { type: "SET_NOTE"; ref: VerseRef; note: string }
  | { type: "CLEAR"; refs: VerseRef[] };

function blank(ref: VerseRef): VerseAnnotation {
  return { ...ref, favorite: false, color: null, note: "", updatedAt: 0 };
}

// Applies `patch` to every ref, dropping records that end up with no marks
// left so the store only ever holds verses the reader actually marked.
function patchRefs(
  map: AnnotationMap,
  refs: VerseRef[],
  patch: (current: VerseAnnotation) => VerseAnnotation
): AnnotationMap {
  const next = { ...map };
  const now = Date.now();
  for (const ref of refs) {
    const key = verseKey(ref);
    const updated = { ...patch(next[key] ?? blank(ref)), ...ref, updatedAt: now };
    if (isEmptyAnnotation(updated)) delete next[key];
    else next[key] = updated;
  }
  return next;
}

function reducer(state: AnnotationMap, action: Action): AnnotationMap {
  switch (action.type) {
    case "TOGGLE_FAVORITE": {
      // A multi-verse selection acts as one unit: if any verse in it is not yet
      // a favorite the whole range becomes one, otherwise the whole range clears.
      const turnOn = action.refs.some((ref) => !state[verseKey(ref)]?.favorite);
      return patchRefs(state, action.refs, (current) => ({ ...current, favorite: turnOn }));
    }
    case "SET_COLOR":
      return patchRefs(state, action.refs, (current) => ({ ...current, color: action.color }));
    case "SET_NOTE":
      return patchRefs(state, [action.ref], (current) => ({ ...current, note: action.note }));
    case "CLEAR":
      return patchRefs(state, action.refs, (current) => ({ ...current, favorite: false, color: null, note: "" }));
    default:
      return state;
  }
}

export interface AnnotationActions {
  toggleFavorite(refs: VerseRef[]): void;
  setColor(refs: VerseRef[], color: HighlightColor | null): void;
  setNote(ref: VerseRef, note: string): void;
  clear(refs: VerseRef[]): void;
}

interface AnnotationsContextValue {
  annotations: AnnotationMap;
  actions: AnnotationActions;
}

const AnnotationsContext = createContext<AnnotationsContextValue | null>(null);

export function AnnotationsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [annotations, dispatch] = useReducer(reducer, undefined, readAnnotations);

  useEffect(() => {
    writeAnnotations(annotations);
  }, [annotations]);

  const actions = useMemo<AnnotationActions>(
    () => ({
      toggleFavorite: (refs) => dispatch({ type: "TOGGLE_FAVORITE", refs }),
      setColor: (refs, color) => dispatch({ type: "SET_COLOR", refs, color }),
      setNote: (ref, note) => dispatch({ type: "SET_NOTE", ref, note }),
      clear: (refs) => dispatch({ type: "CLEAR", refs })
    }),
    []
  );

  const value = useMemo<AnnotationsContextValue>(() => ({ annotations, actions }), [annotations, actions]);

  return <AnnotationsContext.Provider value={value}>{children}</AnnotationsContext.Provider>;
}

export function useAnnotations(): AnnotationsContextValue {
  const ctx = useContext(AnnotationsContext);
  if (!ctx) throw new Error("useAnnotations must be used within an AnnotationsProvider");
  return ctx;
}

// The marks for one chapter, keyed by verse number — what the reader columns
// need to paint a chapter without walking the whole store per verse.
export function chapterMarks(
  annotations: AnnotationMap,
  bookId: string,
  chapter: number
): Map<number, VerseAnnotation> {
  const out = new Map<number, VerseAnnotation>();
  for (const a of Object.values(annotations)) {
    if (a.bookId === bookId && a.chapter === chapter) out.set(a.verse, a);
  }
  return out;
}

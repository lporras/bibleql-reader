import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { AnnotationMap, HighlightColor, VerseAnnotation, VerseRef } from "../types/annotations";
import { annotationsReducer } from "./annotations";
import { readAnnotations, writeAnnotations } from "./persist";

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
  const [annotations, dispatch] = useReducer(annotationsReducer, undefined, readAnnotations);

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

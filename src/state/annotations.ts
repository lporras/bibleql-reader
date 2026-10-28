import {
  isEmptyAnnotation,
  verseKey,
  type AnnotationMap,
  type HighlightColor,
  type VerseAnnotation,
  type VerseRef
} from "../types/annotations";

// Pure model for verse marks — the reducer AnnotationsContext runs. Kept free
// of React and storage so it's unit-tested directly (annotations.test.ts).

export type AnnotationsAction =
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
    // Only the identity fields: a caller may hand in a whole VerseAnnotation
    // (the Marks list does), and spreading that would put back the very
    // marks the patch just removed.
    const { bookId, chapter, verse } = ref;
    const base = next[key] ?? blank({ bookId, chapter, verse });
    const updated = { ...patch(base), bookId, chapter, verse, updatedAt: now };
    if (isEmptyAnnotation(updated)) delete next[key];
    else next[key] = updated;
  }
  return next;
}

export function annotationsReducer(state: AnnotationMap, action: AnnotationsAction): AnnotationMap {
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

import { describe, it, expect } from "vitest";
import { annotationsReducer, type AnnotationsAction } from "./annotations";
import { verseKey, type AnnotationMap, type VerseRef } from "../types/annotations";

const JHN_3_16: VerseRef = { bookId: "JHN", chapter: 3, verse: 16 };
const JHN_3_17: VerseRef = { bookId: "JHN", chapter: 3, verse: 17 };

function run(state: AnnotationMap, ...actions: AnnotationsAction[]): AnnotationMap {
  return actions.reduce(annotationsReducer, state);
}

describe("annotationsReducer", () => {
  it("drops a verse once its last mark is cleared", () => {
    const marked = run({}, { type: "TOGGLE_FAVORITE", refs: [JHN_3_16] }, { type: "SET_COLOR", refs: [JHN_3_16], color: "yellow" });
    expect(marked[verseKey(JHN_3_16)]).toMatchObject({ favorite: true, color: "yellow" });

    expect(run(marked, { type: "CLEAR", refs: [JHN_3_16] })).toEqual({});
  });

  // The Marks list passes the whole stored record as the ref; its own
  // favorite/color/note must not be spread back over the cleared values.
  it("clears when handed a full annotation rather than a bare ref", () => {
    const marked = run(
      {},
      { type: "TOGGLE_FAVORITE", refs: [JHN_3_16, JHN_3_17] },
      { type: "SET_NOTE", ref: JHN_3_16, note: "For God so loved" }
    );
    const record = marked[verseKey(JHN_3_16)];

    const next = run(marked, { type: "CLEAR", refs: [record] });

    expect(next[verseKey(JHN_3_16)]).toBeUndefined();
    expect(next[verseKey(JHN_3_17)]).toMatchObject({ favorite: true });
  });

  it("keeps only identity fields from the ref on every patch", () => {
    const record = { ...JHN_3_16, favorite: true, color: "green" as const, note: "stale", updatedAt: 1 };

    const next = run({}, { type: "SET_NOTE", ref: record, note: "fresh" });

    expect(next[verseKey(JHN_3_16)]).toMatchObject({ favorite: false, color: null, note: "fresh" });
  });

  it("toggles a multi-verse selection as one unit", () => {
    const one = run({}, { type: "TOGGLE_FAVORITE", refs: [JHN_3_16] });
    const both = run(one, { type: "TOGGLE_FAVORITE", refs: [JHN_3_16, JHN_3_17] });
    expect(both[verseKey(JHN_3_16)]?.favorite && both[verseKey(JHN_3_17)]?.favorite).toBe(true);

    expect(run(both, { type: "TOGGLE_FAVORITE", refs: [JHN_3_16, JHN_3_17] })).toEqual({});
  });
});

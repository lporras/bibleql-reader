import { describe, it, expect } from "vitest";
import { emptyStudy, passageReference, studiesReducer, versesFromRange, type StudiesAction } from "./study";
import type { StudiesState, StudyPassage } from "../types/study";

function passage(id: string, bookId: string, chapter: number, verses: number[], translationId = "eng-web"): StudyPassage {
  return { id, bookId, chapter, verses, translationId, text: "", source: "reader", why: "", addedAt: 1 };
}

function run(state: StudiesState, ...actions: StudiesAction[]): StudiesState {
  return actions.reduce(studiesReducer, state);
}

const EMPTY: StudiesState = { studies: [], activeId: null };

describe("studiesReducer", () => {
  it("creating a study makes it the active one", () => {
    const state = run(EMPTY, { type: "CREATE", study: emptyStudy("s1", "Grace", 10) });
    expect(state.activeId).toBe("s1");
    expect(state.studies.map((s) => s.title)).toEqual(["Grace"]);
  });

  it("updates bump updatedAt but keep createdAt", () => {
    const state = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Grace", 10) },
      { type: "UPDATE", id: "s1", patch: { title: "Amazing grace" }, now: 20 }
    );
    expect(state.studies[0]).toMatchObject({ title: "Amazing grace", createdAt: 10, updatedAt: 20 });
  });

  it("adding passages skips ones the study already has, and duplicates within the batch", () => {
    const state = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Grace", 10) },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p1", "JHN", 3, [16])], now: 11 },
      {
        type: "ADD_PASSAGES",
        id: "s1",
        passages: [passage("p2", "JHN", 3, [16]), passage("p3", "EPH", 2, [8, 9]), passage("p4", "EPH", 2, [8, 9])],
        now: 12
      }
    );
    expect(state.studies[0].passages.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("the same verses in another translation are a separate passage", () => {
    const state = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Grace", 10) },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p1", "JHN", 3, [16], "eng-web")], now: 11 },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p2", "JHN", 3, [16], "spa-rv1909")], now: 12 },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p3", "JHN", 3, [16], "spa-rv1909")], now: 13 }
    );
    expect(state.studies[0].passages.map((p) => [p.id, p.translationId])).toEqual([
      ["p1", "eng-web"],
      ["p2", "spa-rv1909"]
    ]);
  });

  it("a whole chapter and a verse in it are different passages", () => {
    const state = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Shepherd", 10) },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p1", "PSA", 23, [])], now: 11 },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p2", "PSA", 23, [1])], now: 12 }
    );
    expect(state.studies[0].passages).toHaveLength(2);
  });

  it("an all-duplicate add is a no-op, not an edit", () => {
    const before = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Grace", 10) },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p1", "JHN", 3, [16])], now: 11 }
    );
    const after = studiesReducer(before, {
      type: "ADD_PASSAGES",
      id: "s1",
      passages: [passage("p2", "JHN", 3, [16])],
      now: 99
    });
    expect(after).toBe(before);
  });

  it("moves passages within bounds only", () => {
    const base = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Grace", 10) },
      {
        type: "ADD_PASSAGES",
        id: "s1",
        passages: [passage("a", "JHN", 1, [1]), passage("b", "JHN", 1, [2]), passage("c", "JHN", 1, [3])],
        now: 11
      }
    );
    const moved = studiesReducer(base, { type: "MOVE_PASSAGE", id: "s1", passageId: "c", dir: -1, now: 12 });
    expect(moved.studies[0].passages.map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(studiesReducer(base, { type: "MOVE_PASSAGE", id: "s1", passageId: "a", dir: -1, now: 12 })).toBe(base);
  });

  it("filling in fetched text is not counted as an edit", () => {
    const base = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("s1", "Grace", 10) },
      { type: "ADD_PASSAGES", id: "s1", passages: [passage("p1", "JHN", 3, [16])], now: 11 }
    );
    const filled = studiesReducer(base, { type: "SET_PASSAGE_TEXT", id: "s1", passageId: "p1", text: "For God…" });
    expect(filled.studies[0].passages[0].text).toBe("For God…");
    expect(filled.studies[0].updatedAt).toBe(11);
  });

  it("deleting the active study falls back to the most recently edited one", () => {
    const state = run(
      EMPTY,
      { type: "CREATE", study: emptyStudy("old", "Old", 1) },
      { type: "CREATE", study: emptyStudy("recent", "Recent", 2) },
      { type: "CREATE", study: emptyStudy("current", "Current", 3) },
      { type: "UPDATE", id: "recent", patch: { title: "Recent!" }, now: 50 },
      { type: "DELETE", id: "current" }
    );
    expect(state.activeId).toBe("recent");
    expect(run(state, { type: "DELETE", id: "recent" }, { type: "DELETE", id: "old" }).activeId).toBeNull();
  });

  it("refuses to activate a study that doesn't exist", () => {
    const state = run(EMPTY, { type: "CREATE", study: emptyStudy("s1", "Grace", 10) });
    expect(studiesReducer(state, { type: "SET_ACTIVE", id: "nope" })).toBe(state);
  });
});

describe("passage helpers", () => {
  it("formats references per locale, grouping verse runs", () => {
    expect(passageReference({ bookId: "JHN", chapter: 3, verses: [16, 17, 20] }, "en")).toBe("John 3:16-17, 20");
    expect(passageReference({ bookId: "JHN", chapter: 3, verses: [16] }, "es")).toBe("Juan 3:16");
    expect(passageReference({ bookId: "PSA", chapter: 23, verses: [] }, "en")).toMatch(/^Psalms? 23$/);
  });

  it("turns a parsed range into verses", () => {
    expect(versesFromRange(null, null)).toEqual([]);
    expect(versesFromRange(16, null)).toEqual([16]);
    expect(versesFromRange(21, 23)).toEqual([21, 22, 23]);
    expect(versesFromRange(5, 2)).toEqual([5]);
  });
});

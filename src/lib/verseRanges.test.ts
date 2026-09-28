import { describe, expect, it } from "vitest";
import { decodeVerses, encodeVerses, formatVerseList } from "./verseRanges";

describe("encodeVerses", () => {
  it("collapses a contiguous run", () => {
    expect(encodeVerses([16, 17, 18])).toBe("16-18");
  });

  it("keeps non-contiguous verses separate", () => {
    expect(encodeVerses([16, 18, 20])).toBe("16,18,20");
  });

  it("mixes runs and singles", () => {
    expect(encodeVerses([16, 17, 20])).toBe("16-17,20");
  });

  it("sorts and de-duplicates unordered input", () => {
    expect(encodeVerses([20, 16, 17, 17])).toBe("16-17,20");
  });

  it("handles a single verse", () => {
    expect(encodeVerses([5])).toBe("5");
  });

  it("handles empty input", () => {
    expect(encodeVerses([])).toBe("");
  });
});

describe("decodeVerses", () => {
  it("expands a range", () => {
    expect(decodeVerses("16-18")).toEqual([16, 17, 18]);
  });

  it("parses mixed ranges and singles", () => {
    expect(decodeVerses("16-17,20")).toEqual([16, 17, 20]);
  });

  it("de-duplicates and sorts", () => {
    expect(decodeVerses("20,16-17,17")).toEqual([16, 17, 20]);
  });

  it("ignores malformed segments instead of throwing", () => {
    expect(decodeVerses("16,,abc,18")).toEqual([16, 18]);
  });

  it("round-trips through encodeVerses", () => {
    const verses = [3, 4, 5, 9, 12, 13];
    expect(decodeVerses(encodeVerses(verses))).toEqual(verses);
  });

  it("returns an empty array for empty input", () => {
    expect(decodeVerses("")).toEqual([]);
  });
});

describe("formatVerseList", () => {
  it("adds spacing after commas for display", () => {
    expect(formatVerseList([16, 17, 20])).toBe("16-17, 20");
  });
});

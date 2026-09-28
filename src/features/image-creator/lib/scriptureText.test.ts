import { describe, expect, it } from "vitest";
import { buildReference, buildScriptureText } from "./scriptureText";
import type { Verse } from "../../../types/bible";

const JOHN_3: Verse[] = [
  { verse: 15, text: "  that whoever believes in him should not perish...  " },
  { verse: 16, text: "For God so loved the world," },
  { verse: 17, text: "For God didn't send his Son..." },
  { verse: 18, text: "He who believes in him is not judged." },
  { verse: 20, text: "For everyone who does evil hates the light." }
];

describe("buildScriptureText", () => {
  it("joins selected verses in verse order, trimmed and whitespace-collapsed", () => {
    expect(buildScriptureText(JOHN_3, [16, 17])).toBe(
      "For God so loved the world, For God didn't send his Son..."
    );
  });

  it("supports non-contiguous selections", () => {
    expect(buildScriptureText(JOHN_3, [16, 20])).toBe(
      "For God so loved the world, For everyone who does evil hates the light."
    );
  });

  it("ignores verse numbers not present in the passage", () => {
    expect(buildScriptureText(JOHN_3, [16, 999])).toBe("For God so loved the world,");
  });

  it("returns an empty string when nothing is selected", () => {
    expect(buildScriptureText(JOHN_3, [])).toBe("");
  });
});

describe("buildReference", () => {
  it("formats a contiguous range in English", () => {
    expect(buildReference("JHN", 3, [16, 17], "en")).toBe("John 3:16-17");
  });

  it("formats a non-contiguous selection", () => {
    expect(buildReference("JHN", 3, [16, 17, 20], "en")).toBe("John 3:16-17, 20");
  });

  it("uses the Spanish book name for the es locale", () => {
    expect(buildReference("JHN", 3, [16], "es")).toBe("Juan 3:16");
  });
});

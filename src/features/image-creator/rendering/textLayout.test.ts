import { describe, expect, it } from "vitest";
import { wrapLines } from "./textLayout";

// A fake 2D context: width = character count, so wrapping behavior is
// deterministic without a real canvas (node test environment has none).
function fakeCtx(): CanvasRenderingContext2D {
  return { measureText: (text: string) => ({ width: text.length }) } as unknown as CanvasRenderingContext2D;
}

describe("wrapLines", () => {
  it("keeps a short line on one line", () => {
    expect(wrapLines(fakeCtx(), "For God so loved", 100)).toEqual(["For God so loved"]);
  });

  it("wraps once maxWidth is exceeded", () => {
    const lines = wrapLines(fakeCtx(), "one two three four", 10);
    expect(lines).toEqual(["one two", "three four"]);
  });

  it("never drops a word that alone exceeds maxWidth", () => {
    const lines = wrapLines(fakeCtx(), "supercalifragilisticexpialidocious", 5);
    expect(lines).toEqual(["supercalifragilisticexpialidocious"]);
  });

  it("honors explicit newlines as paragraph breaks", () => {
    const lines = wrapLines(fakeCtx(), "verse one\nverse two", 100);
    expect(lines).toEqual(["verse one", "verse two"]);
  });
});

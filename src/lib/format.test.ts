import { describe, expect, it } from "vitest";
import { splitTemplate } from "./format";
import { STR } from "../data/strings";

describe("splitTemplate", () => {
  it("splits the English photoBy template into ordered parts", () => {
    expect(splitTemplate(STR.en.photoBy, ["s", "l"])).toEqual([
      { type: "text", text: "Photo by " },
      { type: "slot", key: "s" },
      { type: "text", text: " on " },
      { type: "slot", key: "l" }
    ]);
  });

  it("keeps the Spanish template's own wording and order", () => {
    expect(splitTemplate(STR.es.photoBy, ["s", "l"])).toEqual([
      { type: "text", text: "Foto de " },
      { type: "slot", key: "s" },
      { type: "text", text: " en " },
      { type: "slot", key: "l" }
    ]);
  });

  it("leaves a placeholder that wasn't asked for as literal text", () => {
    expect(splitTemplate("a %x b %s", ["s"])).toEqual([
      { type: "text", text: "a %x b " },
      { type: "slot", key: "s" }
    ]);
  });

  it("handles a slot at the very start and back-to-back slots", () => {
    expect(splitTemplate("%s%l!", ["s", "l"])).toEqual([
      { type: "slot", key: "s" },
      { type: "slot", key: "l" },
      { type: "text", text: "!" }
    ]);
  });

  it("returns a template with no slots unchanged as one text part", () => {
    expect(splitTemplate("no slots here", ["s"])).toEqual([{ type: "text", text: "no slots here" }]);
    expect(splitTemplate("", ["s"])).toEqual([]);
  });

  it("prefers the longest matching key so one key can't shadow another", () => {
    expect(splitTemplate("%source", ["s", "source"])).toEqual([{ type: "slot", key: "source" }]);
  });
});

import { describe, expect, it } from "vitest";
import { createDefaultProject } from "./defaults";
import { fromJSON, fromParsed, ProjectVersionError, toJSON } from "./serialize";

describe("toJSON / fromJSON", () => {
  it("round-trips a project unchanged", () => {
    const project = createDefaultProject({
      translationId: "eng-web",
      bookId: "JHN",
      chapter: 3,
      verses: [16, 17],
      reference: "John 3:16-17"
    });

    const restored = fromJSON(toJSON(project));
    expect(restored).toEqual(project);
  });
});

describe("fromParsed", () => {
  it("rejects a missing version", () => {
    expect(() => fromParsed({ id: "x" })).toThrow(ProjectVersionError);
  });

  it("rejects an unknown version rather than coercing it", () => {
    expect(() => fromParsed({ version: 99 })).toThrow(ProjectVersionError);
  });

  it("rejects non-object input", () => {
    expect(() => fromParsed(null)).toThrow(ProjectVersionError);
    expect(() => fromParsed("not a project")).toThrow(ProjectVersionError);
  });

  it("accepts the current version", () => {
    const project = createDefaultProject();
    expect(fromParsed(JSON.parse(toJSON(project)))).toEqual(project);
  });
});

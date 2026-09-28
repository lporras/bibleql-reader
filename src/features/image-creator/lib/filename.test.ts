import { describe, expect, it } from "vitest";
import { buildExportFilename } from "./filename";
import { createDefaultProject } from "../model/defaults";

describe("buildExportFilename", () => {
  it("slugifies the reference and preset", () => {
    const project = createDefaultProject({
      translationId: "eng-web",
      bookId: "JHN",
      chapter: 3,
      verses: [16],
      reference: "John 3:16"
    });
    expect(buildExportFilename(project, "png")).toBe("john-3-16-instagram-portrait.png");
  });

  it("strips diacritics from a Spanish reference", () => {
    const project = createDefaultProject({
      translationId: "spa-nvi",
      bookId: "JHN",
      chapter: 3,
      verses: [16],
      reference: "Juan 3:16"
    });
    expect(buildExportFilename(project, "jpg")).toBe("juan-3-16-instagram-portrait.jpg");
  });

  it("falls back to the project name when there's no bible source", () => {
    const project = createDefaultProject();
    project.name = "My Design!";
    expect(buildExportFilename(project, "png")).toBe("my-design-instagram-portrait.png");
  });
});

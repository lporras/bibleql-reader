import { PROJECT_VERSION, type BibleSource, type ImageCreatorProject, type TextElement } from "./types";
import { canvasForPreset } from "./presets";
import { DEFAULT_FONT } from "./fonts";

function newId(): string {
  return crypto.randomUUID();
}

export function createDefaultScriptureElement(text: string): TextElement {
  return {
    id: newId(),
    kind: "scripture",
    text,
    x: 0.1,
    y: 0.16,
    width: 0.8,
    fontFamily: DEFAULT_FONT.family,
    fontSize: 0.038,
    fontWeight: 500,
    fontStyle: "normal",
    color: "#ffffff",
    opacity: 1,
    textAlign: "center",
    lineHeight: 1.35
  };
}

// Pinned near the bottom edge rather than just under the scripture text —
// a multi-verse selection can wrap to many lines at the default font size,
// and a fixed offset from the top would have it overlap the reference
// (verified by actually running the editor with a two-verse selection).
// The user can still drag either box anywhere afterward.
export function createDefaultReferenceElement(reference: string): TextElement {
  return {
    id: newId(),
    kind: "reference",
    text: reference,
    x: 0.1,
    y: 0.88,
    width: 0.8,
    fontFamily: DEFAULT_FONT.family,
    fontSize: 0.026,
    fontWeight: 700,
    fontStyle: "normal",
    color: "#ffffff",
    opacity: 0.85,
    textAlign: "center",
    lineHeight: 1.2
  };
}

export function createDefaultProject(bibleSource?: BibleSource, scriptureText?: string): ImageCreatorProject {
  const now = new Date().toISOString();
  const elements: TextElement[] = bibleSource
    ? [createDefaultScriptureElement(scriptureText ?? ""), createDefaultReferenceElement(bibleSource.reference)]
    : [];

  return {
    version: PROJECT_VERSION,
    id: newId(),
    name: bibleSource?.reference || "Untitled",
    canvas: canvasForPreset("instagram-portrait"),
    background: null,
    bibleSource,
    elements,
    createdAt: now,
    updatedAt: now
  };
}

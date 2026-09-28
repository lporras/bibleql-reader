import type { ImageCreatorProject } from "../model/types";

// "John 3:16-17" -> "john-3-16-17"; strips diacritics too, so a Spanish
// reference like "Juan 3:16" still produces a portable ASCII filename.
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "john-3-16-17-instagram-portrait.png" — matches the naming spec calls
 * out in §15 (e.g. "john-3-16-instagram-story.png").
 */
export function buildExportFilename(project: ImageCreatorProject, extension: "png" | "jpg"): string {
  const referencePart = slugify(project.bibleSource?.reference || project.name || "image");
  const presetPart = slugify(project.canvas.preset);
  return `${referencePart}-${presetPart}.${extension}`;
}

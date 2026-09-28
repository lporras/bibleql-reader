import { PROJECT_VERSION, type ImageCreatorProject } from "./types";

export class ProjectVersionError extends Error {
  constructor(public readonly foundVersion: unknown) {
    super(`Unsupported Image Creator project version: ${JSON.stringify(foundVersion)}`);
    this.name = "ProjectVersionError";
  }
}

/**
 * Serializes a project to a JSON string. Kept as a named function (rather
 * than a bare `JSON.stringify` at call sites) so a future version needing
 * custom encoding doesn't require touching every caller.
 */
export function toJSON(project: ImageCreatorProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Parses a serialized project, rejecting anything whose `version` isn't
 * one this build understands. This is the seam a migration would hook
 * into once PROJECT_VERSION moves past 1 — never silently coerce an
 * unknown shape.
 */
export function fromJSON(json: string): ImageCreatorProject {
  const parsed: unknown = JSON.parse(json);
  return fromParsed(parsed);
}

export function fromParsed(parsed: unknown): ImageCreatorProject {
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
    throw new ProjectVersionError(undefined);
  }
  const version = (parsed as { version: unknown }).version;
  if (version !== PROJECT_VERSION) {
    throw new ProjectVersionError(version);
  }
  // Structurally trust the rest — this is a v1 project produced by this
  // same app, not third-party input. Deeper structural validation can be
  // added (validation.ts) if `.bibleql` files start being shared/imported.
  return parsed as ImageCreatorProject;
}

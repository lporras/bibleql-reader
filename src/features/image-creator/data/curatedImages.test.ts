import { describe, expect, it } from "vitest";
import { CURATED_IMAGES, CURATED_SOURCES } from "./curatedImages";

// Guards the compliance-critical half of the curated library. An earlier
// version derived each photographer's profile URL from the download
// filename slug (`unsplash.com/@{name-slug}`) and all six links 404'd,
// which breaks the Unsplash guideline requiring a working link back to
// the photographer's profile. These assertions make that class of bug
// fail here rather than in front of a reviewer.
//
// What they can't do is prove a handle exists — that needs a network
// call, which specs in this project never make. Verify new entries by
// opening the photo page on unsplash.com by hand.
//
// Nor do they touch the filesystem to confirm each photo is really in
// public/bible-images: this project is type-checked under tsconfig.json,
// which has no node types on purpose (the frontend runs in a webview).
// e2e/image-creator.spec.ts covers that instead, by waiting on the
// thumbnails actually rendering.

describe("CURATED_SOURCES", () => {
  it("has entries", () => {
    expect(CURATED_SOURCES.length).toBeGreaterThan(0);
  });

  it.each(CURATED_SOURCES)("$fileName has an explicit, plausible @handle", (source) => {
    // Unsplash handles are lowercase alphanumerics/underscores. Every one
    // of the six broken guesses contained a hyphen, because a slugified
    // display name does; a handle doesn't.
    expect(source.photographerUsername).toMatch(/^[a-z0-9_]+$/);
    expect(source.photographerName.trim()).not.toBe("");
  });

  it.each(CURATED_SOURCES)("$fileName doesn't reuse the old slug-derived handle", (source) => {
    // The exact derivation that produced six dead links, asserted impossible.
    const slug = source.fileName.slice(0, source.fileName.lastIndexOf(`-${source.photoId}`));
    expect(source.photographerUsername).not.toBe(slug);
  });

  it.each(CURATED_SOURCES)("$fileName follows Unsplash's download filename convention", (source) => {
    expect(source.fileName).toBe(`${source.fileName.slice(0, source.fileName.lastIndexOf(`-${source.photoId}`))}-${source.photoId}-unsplash.jpg`);
    expect(source.photoId).toHaveLength(11);
  });

});

describe("CURATED_IMAGES", () => {
  it("maps one entry per source", () => {
    expect(CURATED_IMAGES).toHaveLength(CURATED_SOURCES.length);
  });

  it.each(CURATED_IMAGES.map((image, index) => ({ image, source: CURATED_SOURCES[index] })))(
    "$source.fileName links to the verified profile and photo page, UTM-tagged",
    ({ image, source }) => {
      const profile = new URL(image.attribution.photographerUrl!);
      expect(profile.origin + profile.pathname).toBe(`https://unsplash.com/@${source.photographerUsername}`);
      expect(profile.searchParams.get("utm_source")).toBe("bibleql-reader");
      expect(profile.searchParams.get("utm_medium")).toBe("referral");

      const photo = new URL(image.attribution.sourceUrl!);
      expect(photo.origin + photo.pathname).toBe(`https://unsplash.com/photos/${source.photoId}`);
      expect(photo.searchParams.get("utm_source")).toBe("bibleql-reader");
      expect(photo.searchParams.get("utm_medium")).toBe("referral");

      expect(image.attribution.photographerName).toBe(source.photographerName);
      expect(image.attribution.sourceName).toBe("Unsplash");
    }
  );

  it.each(CURATED_IMAGES.map((image, index) => ({ image, source: CURATED_SOURCES[index] })))(
    "$source.fileName uses root-absolute asset URLs",
    ({ image, source }) => {
      expect(image.id).toBe(source.photoId);
      expect(image.thumbUrl).toBe(`/bible-images/thumb/${source.fileName}`);
      expect(image.fullUrl).toBe(`/bible-images/full/${source.fileName}`);
      // Tauri serves the frontend from an origin root in BOTH dev
      // (http://localhost:1420/) and production (tauri://localhost/), so a
      // leading "/" is correct and unambiguous. This assertion was
      // inverted during the Electron->Tauri migration: under Electron the
      // packaged app loaded index.html over file://, where "/" would have
      // resolved against the filesystem root instead of out/renderer.
      expect(image.thumbUrl.startsWith("/")).toBe(true);
      expect(image.fullUrl.startsWith("/")).toBe(true);
    }
  );
});

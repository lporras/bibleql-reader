import { describe, expect, it } from "vitest";
import { isTrackableDownloadLocation } from "./unsplashDownload";
import { MOUNTAIN_PHOTO } from "./__fixtures__/unsplashPhotos";

// Pure guard, no network — the ping itself lives in UnsplashProvider.ts
// (which needs __UNSPLASH_ACCESS_KEY__ at module scope and so isn't
// importable here).
describe("isTrackableDownloadLocation", () => {
  it("accepts the download_location the API actually returns", () => {
    expect(isTrackableDownloadLocation(MOUNTAIN_PHOTO.links.download_location)).toBe(true);
  });

  it("accepts the endpoint with no ixid query", () => {
    expect(isTrackableDownloadLocation("https://api.unsplash.com/photos/abc123/download")).toBe(true);
  });

  it("rejects a different origin, so the access key can't leak off api.unsplash.com", () => {
    expect(isTrackableDownloadLocation("https://evil.example/photos/abc123/download")).toBe(false);
    // Right host, wrong scheme — still not the API origin.
    expect(isTrackableDownloadLocation("http://api.unsplash.com/photos/abc123/download")).toBe(false);
  });

  it("rejects a path that isn't the download endpoint", () => {
    expect(isTrackableDownloadLocation("https://api.unsplash.com/photos/abc123")).toBe(false);
    expect(isTrackableDownloadLocation("https://api.unsplash.com/me")).toBe(false);
  });

  it("rejects anything that isn't a parseable absolute URL", () => {
    expect(isTrackableDownloadLocation("")).toBe(false);
    expect(isTrackableDownloadLocation("/photos/abc123/download")).toBe(false);
    expect(isTrackableDownloadLocation("not a url")).toBe(false);
  });
});

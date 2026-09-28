import { describe, expect, it } from "vitest";
import { buildUnsplashAttribution, unsplashPhotoUrl, unsplashProfileUrl } from "./attribution";

describe("unsplash URL helpers", () => {
  it("builds a profile URL from a verified handle", () => {
    expect(unsplashProfileUrl("aaronburden")).toBe("https://unsplash.com/@aaronburden");
  });

  it("builds a photo-page URL from a photo id", () => {
    expect(unsplashPhotoUrl("9zsHNt5OpqE")).toBe("https://unsplash.com/photos/9zsHNt5OpqE");
  });
});

describe("buildUnsplashAttribution", () => {
  it("carries the photographer name through unchanged", () => {
    const attribution = buildUnsplashAttribution("Kalen Emsley", "https://unsplash.com/@kalenemsley", "https://unsplash.com/photos/abc123");
    expect(attribution.photographerName).toBe("Kalen Emsley");
    expect(attribution.sourceName).toBe("Unsplash");
  });

  it("adds the required utm_source and utm_medium params to both links", () => {
    const attribution = buildUnsplashAttribution("Kalen Emsley", "https://unsplash.com/@kalenemsley", "https://unsplash.com/photos/abc123");

    const photographerUrl = new URL(attribution.photographerUrl!);
    expect(photographerUrl.searchParams.get("utm_source")).toBe("bibleql-reader");
    expect(photographerUrl.searchParams.get("utm_medium")).toBe("referral");
    expect(photographerUrl.origin + photographerUrl.pathname).toBe("https://unsplash.com/@kalenemsley");

    const sourceUrl = new URL(attribution.sourceUrl!);
    expect(sourceUrl.searchParams.get("utm_source")).toBe("bibleql-reader");
    expect(sourceUrl.searchParams.get("utm_medium")).toBe("referral");
    expect(sourceUrl.origin + sourceUrl.pathname).toBe("https://unsplash.com/photos/abc123");
  });

  it("doesn't duplicate existing query params on a URL that already has some", () => {
    const attribution = buildUnsplashAttribution("Name", "https://unsplash.com/@name?ref=x", "https://unsplash.com/photos/abc123");
    const url = new URL(attribution.photographerUrl!);
    expect(url.searchParams.get("ref")).toBe("x");
    expect(url.searchParams.get("utm_source")).toBe("bibleql-reader");
  });
});

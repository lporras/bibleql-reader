import { describe, expect, it } from "vitest";
import { mapBackgroundImage } from "./mapBackgroundImage";
import { MOUNTAIN_IMAGE, SPARSE_IMAGE } from "./__fixtures__/backgroundImages";

describe("mapBackgroundImage", () => {
  it("maps a BibleQL result to this app's provider-neutral shape", () => {
    const result = mapBackgroundImage(MOUNTAIN_IMAGE)!;

    expect(result.id).toBe("Bkci_8qcdvQ");
    expect(result.thumbnailUrl).toBe(MOUNTAIN_IMAGE.urls.thumb);
    expect(result.previewUrl).toBe(MOUNTAIN_IMAGE.urls.regular);
    expect(result.width).toBe(5760);
    expect(result.height).toBe(3840);
  });

  it("keeps the UTM-tagged attribution without duplicating the server's parameters", () => {
    const { attribution } = mapBackgroundImage(MOUNTAIN_IMAGE)!;

    expect(attribution.photographerName).toBe("Kalen Emsley");
    expect(attribution.sourceName).toBe("Unsplash");
    expect(attribution.photographerUrl).toBe(
      "https://unsplash.com/@kalenemsley?utm_source=bibleql-reader&utm_medium=referral"
    );
    expect(attribution.sourceUrl?.match(/utm_source=/g)).toHaveLength(1);
  });

  it("fills in what Unsplash left out", () => {
    const result = mapBackgroundImage(SPARSE_IMAGE)!;

    expect(result.previewUrl).toBe(SPARSE_IMAGE.urls.small);
    expect(result.thumbnailUrl).toBe(SPARSE_IMAGE.urls.small);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.attribution.photographerUrl).toContain("https://unsplash.com/@janedoe?");
    expect(result.attribution.sourceUrl).toContain("https://unsplash.com/photos/8mikJ83LmSQ?");
    expect(result.attribution.sourceUrl).toContain("utm_medium=referral");
  });

  it("drops a result with no image URL at all", () => {
    const noUrls = { ...SPARSE_IMAGE, urls: { regular: null, small: null, thumb: null } };
    expect(mapBackgroundImage(noUrls)).toBeNull();
  });
});

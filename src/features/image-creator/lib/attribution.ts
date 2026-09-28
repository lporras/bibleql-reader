import type { Attribution } from "../model/types";

// Identifies this app in Unsplash's referral tracking — required by the
// attribution guideline (see docs/unsplash.md). Not a secret; just a slug.
const APP_SLUG = "bibleql-reader";

function withUtm(url: string): string {
  const withParams = new URL(url);
  withParams.searchParams.set("utm_source", APP_SLUG);
  withParams.searchParams.set("utm_medium", "referral");
  return withParams.toString();
}

/** Canonical Unsplash profile URL for a *verified* @handle. */
export function unsplashProfileUrl(username: string): string {
  return `https://unsplash.com/@${username}`;
}

/** Canonical Unsplash photo-page URL for a photo id. */
export function unsplashPhotoUrl(photoId: string): string {
  return `https://unsplash.com/photos/${photoId}`;
}

/**
 * Builds spec-compliant Unsplash attribution: "Photo by {name} on
 * Unsplash", both links carrying the required UTM parameters
 * (https://help.unsplash.com/en/articles/2511315-api-guidelines). Shared
 * by the curated image library and live Unsplash search so neither path
 * can drift out of compliance independently.
 */
export function buildUnsplashAttribution(photographerName: string, photographerProfileUrl: string, unsplashLinkUrl: string): Attribution {
  return {
    photographerName,
    photographerUrl: withUtm(photographerProfileUrl),
    sourceName: "Unsplash",
    sourceUrl: withUtm(unsplashLinkUrl)
  };
}

import { buildUnsplashAttribution, unsplashPhotoUrl, unsplashProfileUrl } from "../lib/attribution";
import type { ImageSearchResult } from "./ImageProvider";

// The fields this app reads from BibleQL's `BackgroundImage` (an Unsplash
// photo, proxied — see docs/unsplash.md). Most are nullable in the schema
// because Unsplash omits them now and then.
export interface BackgroundImageLike {
  id: string;
  width: number | null;
  height: number | null;
  urls: { regular: string | null; small: string | null; thumb: string | null };
  photographer: { name: string; username: string | null; profileUrl: string | null };
  unsplashUrl: string | null;
}

// Only used when Unsplash leaves the size out; the editor's crop math needs
// some aspect ratio, and the real one shows as soon as the image loads.
const FALLBACK_SIZE = 1080;

/**
 * Maps one result to this app's provider-neutral shape, or null when it has
 * no usable image URL. The URLs are Unsplash's CDN links, hotlinked as the
 * API guidelines require. Attribution goes through the same builder as the
 * curated library, so the UTM parameters are added here whether or not the
 * server's links already carry them (withUtm sets, never duplicates).
 */
export function mapBackgroundImage(image: BackgroundImageLike): ImageSearchResult | null {
  const previewUrl = image.urls.regular ?? image.urls.small;
  const thumbnailUrl = image.urls.thumb ?? image.urls.small ?? previewUrl;
  if (!previewUrl || !thumbnailUrl) return null;

  const { photographer } = image;
  const profileUrl =
    photographer.profileUrl ?? (photographer.username ? unsplashProfileUrl(photographer.username) : "https://unsplash.com");

  return {
    id: image.id,
    thumbnailUrl,
    previewUrl,
    width: image.width ?? FALLBACK_SIZE,
    height: image.height ?? FALLBACK_SIZE,
    attribution: buildUnsplashAttribution(photographer.name, profileUrl, image.unsplashUrl ?? unsplashPhotoUrl(image.id))
  };
}

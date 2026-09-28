import { buildUnsplashAttribution } from "../lib/attribution";
import type { ImageSearchResult } from "./ImageProvider";

// A structural subset of unsplash-js's generated `AssetBasic` — only the
// fields this function actually reads. Kept narrow (rather than
// importing the full SDK type) so fixture objects in tests don't need to
// fake out fields nothing here touches, and so this file has no runtime
// dependency on unsplash-js at all.
export interface UnsplashPhotoLike {
  id: string;
  width: number;
  height: number;
  urls: { thumb: string; regular: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}

// Kept separate from UnsplashProvider.ts (which calls `createApi` at
// module scope) so this pure mapping is importable/testable — see
// UnsplashProvider.test.ts — without needing __UNSPLASH_ACCESS_KEY__
// defined (Vitest doesn't run through electron-vite's build config).
export function mapUnsplashPhoto(photo: UnsplashPhotoLike): ImageSearchResult {
  return {
    id: photo.id,
    thumbnailUrl: photo.urls.thumb,
    previewUrl: photo.urls.regular,
    width: photo.width,
    height: photo.height,
    attribution: buildUnsplashAttribution(photo.user.name, photo.user.links.html, photo.links.html),
    downloadLocation: photo.links.download_location
  };
}

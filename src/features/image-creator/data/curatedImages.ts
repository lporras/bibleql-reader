import { buildUnsplashAttribution, unsplashPhotoUrl, unsplashProfileUrl } from "../lib/attribution";
import type { Attribution } from "../model/types";

// A small, fixed, developer-curated background library (spec's "Flow C
// / curated-local-library" option) — bundled under public/bible-images/
// so Vite serves it as static files
// (thumb/ for the picker grid, full/ for the actual background) rather
// than importing each photo through the JS bundle. Originals came from
// /Users/lporras/Pictures/bible_images (already-downloaded Unsplash
// photos); each was resized once (thumb ≤480px, full ≤2000px — comfortably
// above every social preset in model/presets.ts) to keep the app's
// install size reasonable, then copied here — the ~/Pictures originals
// were left untouched.
//
// These six were downloaded from unsplash.com under the Unsplash License,
// *not* obtained through the API, so the API's hotlinking rule doesn't
// reach them (it governs "all API uses"). Every live search result is
// hotlinked — see providers/mapUnsplashPhoto.ts and docs/unsplash.md.
//
// Attribution is still required regardless of how a photo was obtained
// (spec §8), and it must actually resolve: the guideline wants a working
// "link back to their Unsplash profile".
//
// ⚠️ The photographer's @handle is NOT derivable from the filename.
// Unsplash's download filename convention
// (`{name-slug}-{11-char-photo-id}-unsplash.jpg`) embeds a slugified
// *display name*, which is a different thing from the account handle. An
// earlier version of this file guessed `unsplash.com/@{name-slug}` and
// every single one of the six links 404'd (e.g. "Alicia Quan" is
// @alicia2joy, "Samuel McGarrigle" is @tempographics). So both the
// display name and the handle are explicit, per-entry fields below,
// each verified by opening the photo page on unsplash.com (last verified
// 2026-09-15). Verify any new entry the same way — data/curatedImages.test.ts
// enforces the shape but cannot check a handle actually exists.
export interface CuratedImage {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  attribution: Attribution;
}

export interface CuratedImageSource {
  fileName: string;
  photoId: string;
  /** Display name, copied verbatim from the photographer's Unsplash profile. */
  photographerName: string;
  /** Unsplash @handle, verified by opening the profile. Never derived from fileName. */
  photographerUsername: string;
  width: number;
  height: number;
}

function curated(source: CuratedImageSource): CuratedImage {
  return {
    id: source.photoId,
    // Absolute paths: Tauri serves the frontend from the root of an
    // origin — `http://localhost:1420/` in dev, `tauri://localhost/` in
    // production — so "/bible-images/..." resolves the same way in both.
    // (These were relative under Electron only because its production
    // build loaded index.html over `file://`, where a leading "/" means
    // the filesystem root.)
    thumbUrl: `/bible-images/thumb/${source.fileName}`,
    fullUrl: `/bible-images/full/${source.fileName}`,
    width: source.width,
    height: source.height,
    // Same builder (and UTM parameters) live search uses — see
    // lib/attribution.ts and providers/mapUnsplashPhoto.ts, so neither
    // path can drift out of compliance independently.
    attribution: buildUnsplashAttribution(
      source.photographerName,
      unsplashProfileUrl(source.photographerUsername),
      unsplashPhotoUrl(source.photoId)
    )
  };
}

export const CURATED_SOURCES: CuratedImageSource[] = [
  {
    fileName: "aaron-burden-9zsHNt5OpqE-unsplash.jpg",
    photoId: "9zsHNt5OpqE",
    photographerName: "Aaron Burden",
    photographerUsername: "aaronburden",
    width: 2000,
    height: 1500
  },
  {
    fileName: "aaron-burden-Ncn1jiEe-Wc-unsplash.jpg",
    photoId: "Ncn1jiEe-Wc",
    photographerName: "Aaron Burden",
    photographerUsername: "aaronburden",
    width: 1429,
    height: 2000
  },
  {
    fileName: "alicia-quan-kBybHJ3CEWI-unsplash.jpg",
    photoId: "kBybHJ3CEWI",
    photographerName: "Alicia Quan",
    photographerUsername: "alicia2joy",
    width: 2000,
    height: 1500
  },
  {
    fileName: "rod-long-DRgrzQQsJDA-unsplash.jpg",
    photoId: "DRgrzQQsJDA",
    photographerName: "Rod Long",
    photographerUsername: "rodlong",
    width: 2000,
    height: 1333
  },
  {
    fileName: "samuel-mcgarrigle-GVRRtaLj3LU-unsplash.jpg",
    photoId: "GVRRtaLj3LU",
    photographerName: "Samuel McGarrigle",
    photographerUsername: "tempographics",
    width: 2000,
    height: 1333
  },
  {
    fileName: "wesley-tingey-y2-FG8oiSiQ-unsplash.jpg",
    photoId: "y2-FG8oiSiQ",
    photographerName: "Wesley Tingey",
    photographerUsername: "wesleyphotography",
    width: 1333,
    height: 2000
  }
];

export const CURATED_IMAGES: CuratedImage[] = CURATED_SOURCES.map(curated);

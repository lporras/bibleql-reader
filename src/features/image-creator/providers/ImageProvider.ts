import type { Attribution } from "../model/types";

// Provider abstraction (spec §8) so components never call an image source
// directly — BibleQLImageProvider.ts is the only thing that knows where
// search results come from (Unsplash, through BibleQL's proxy).
export interface ImageSearchResult {
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  attribution: Attribution;
}

export interface ImageSearchPage {
  results: ImageSearchResult[];
  page: number;
  hasMore: boolean;
}

/** Why a search came back empty-handed — reported by the server as data. */
export type ImageSearchErrorCode = "RATE_LIMITED" | "UNAVAILABLE" | "NOT_CONFIGURED";

export class ImageSearchError extends Error {
  constructor(readonly code: ImageSearchErrorCode) {
    super(`Image search failed: ${code}`);
    this.name = "ImageSearchError";
  }
}

export interface ImageProvider {
  search(query: string, page?: number): Promise<ImageSearchPage>;
  /**
   * Fire-and-forget download-tracking ping, required whenever a photo is
   * actually used (not merely displayed in search results) — see
   * docs/unsplash.md.
   */
  triggerDownload(result: ImageSearchResult): void;
}

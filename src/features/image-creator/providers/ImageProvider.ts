import type { Attribution } from "../model/types";

// Provider abstraction (spec §8) so components never call an image source
// directly — UnsplashProvider.ts is the only thing that knows about
// Unsplash specifically.
export interface ImageSearchResult {
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  attribution: Attribution;
  /**
   * The tracking URL the API itself returned for this photo
   * (`links.download_location`) — carries a signed `ixid` that ties the
   * download event back to the search it came from. Always pass this
   * through verbatim; a hand-built `/photos/:id/download` path is not
   * compliant with the guideline (see docs/unsplash.md).
   */
  downloadLocation: string;
}

export interface ImageSearchPage {
  results: ImageSearchResult[];
  page: number;
  hasMore: boolean;
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

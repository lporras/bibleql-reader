import { gqlRequest } from "../../../lib/graphql";
import { putImageAsset } from "../assets/imageAssets";
import { mapBackgroundImage, type BackgroundImageLike } from "./mapBackgroundImage";
import { ImageSearchError, type ImageSearchErrorCode } from "./ImageProvider";
import type { Background } from "../model/types";
import type { ImageProvider, ImageSearchPage, ImageSearchResult } from "./ImageProvider";

const PER_PAGE = 24;

// Unsplash search, through BibleQL. The Unsplash access key lives only on
// the server; this app sends its installation token like any other BibleQL
// query (`backgroundImages` exists only for installation keys). The server
// also caches results, so popular searches cost Unsplash nothing.
interface BackgroundImagesResponse {
  backgroundImages: {
    images: BackgroundImageLike[];
    page: number;
    hasMore: boolean;
    errorCode: ImageSearchErrorCode | null;
  };
}

const SEARCH =
  "query($q:String!,$p:Int,$n:Int){ backgroundImages(query:$q, page:$p, perPage:$n){ images { id width height urls { regular small thumb } photographer { name username profileUrl } unsplashUrl } page hasMore errorCode } }";

const TRACK = "mutation($id:ID!){ trackImageDownload(input:{imageId:$id}){ queued } }";

async function search(query: string, page = 1): Promise<ImageSearchPage> {
  const data = await gqlRequest<BackgroundImagesResponse>(SEARCH, { q: query, p: page, n: PER_PAGE });
  const result = data.backgroundImages;
  // Unsplash failures arrive as data, not as GraphQL errors.
  if (result.errorCode) throw new ImageSearchError(result.errorCode);
  return {
    results: result.images.map(mapBackgroundImage).filter((r): r is ImageSearchResult => r !== null),
    page: result.page,
    hasMore: result.hasMore
  };
}

function triggerDownload(imageResult: ImageSearchResult): void {
  // The server pings the photo's `download_location` (it kept the signed
  // URL from the search it served), as the guideline requires once a photo
  // is actually used. Fire-and-forget: a failed ping shouldn't disrupt the
  // editor.
  void gqlRequest(TRACK, { id: imageResult.id }).catch(() => {});
}

export const bibleqlImageProvider: ImageProvider = { search, triggerDownload };

/**
 * Turns a search result the user picked into a ready-to-use `Background`.
 * The image is hotlinked directly from Unsplash's CDN (per the API
 * guideline — never downloaded/rehosted); its CORS headers permit
 * `crossOrigin="anonymous"` loading, which is what lets the export
 * renderer read it back out of a `<canvas>` (see rendering/renderProject.ts).
 *
 * Also fires the required download-tracking ping — this is the moment
 * the guideline means by "setting" the photo, not the original search.
 */
export function selectUnsplashBackground(result: ImageSearchResult): Background {
  triggerDownload(result);

  const assetId = crypto.randomUUID();
  putImageAsset(assetId, { objectUrl: result.previewUrl, width: result.width, height: result.height });

  return {
    type: "unsplash",
    assetId,
    sourceId: result.id,
    width: result.width,
    height: result.height,
    attribution: result.attribution,
    crop: { x: 0.5, y: 0.5, scale: 1 }
  };
}

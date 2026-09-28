import { putImageAsset } from "../assets/imageAssets";
import type { CuratedImage } from "../data/curatedImages";
import type { Background } from "../model/types";

/**
 * Turns a curated-library entry into a ready-to-use `Background`. Unlike
 * `pickLocalBackground`, there's no async file read: the full-size image
 * is a static asset already known by URL and dimensions, so this only
 * registers it in the decoded-image cache under a fresh id.
 */
export function selectCuratedBackground(image: CuratedImage): Background {
  const assetId = crypto.randomUUID();
  putImageAsset(assetId, { objectUrl: image.fullUrl, width: image.width, height: image.height });

  return {
    type: "curated",
    assetId,
    sourceId: image.id,
    width: image.width,
    height: image.height,
    attribution: image.attribution,
    crop: { x: 0.5, y: 0.5, scale: 1 }
  };
}

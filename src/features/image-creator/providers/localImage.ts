import { getPlatform } from "../../../platform";
import { putImageAsset } from "../assets/imageAssets";
import type { Background } from "../model/types";

/**
 * Opens the platform's image picker and, if the user chose a file, stores
 * it in the decoded-asset cache and returns a ready-to-use `Background`.
 * Returns null if the user cancelled.
 */
export async function pickLocalBackground(): Promise<Background | null> {
  const picked = await getPlatform().pickImageFile();
  if (!picked) return null;

  const assetId = crypto.randomUUID();
  putImageAsset(assetId, { objectUrl: picked.objectUrl, width: picked.width, height: picked.height });

  return {
    type: "local",
    assetId,
    fileName: picked.fileName,
    width: picked.width,
    height: picked.height,
    crop: { x: 0.5, y: 0.5, scale: 1 }
  };
}

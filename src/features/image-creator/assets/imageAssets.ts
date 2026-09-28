// In-memory cache of decoded background images, keyed by an id stored in
// the project's `background.assetId`. Deliberately outside React state
// (spec §27, "avoid keeping unnecessary full-resolution copies in React
// state") — a project only ever serializes the small `assetId` string,
// never the image bytes.

export interface ImageAssetEntry {
  objectUrl: string;
  width: number;
  height: number;
}

const cache = new Map<string, ImageAssetEntry>();

export function putImageAsset(id: string, entry: ImageAssetEntry): void {
  const existing = cache.get(id);
  if (existing && existing.objectUrl !== entry.objectUrl) {
    URL.revokeObjectURL(existing.objectUrl);
  }
  cache.set(id, entry);
}

export function getImageAsset(id: string): ImageAssetEntry | undefined {
  return cache.get(id);
}

export function releaseImageAsset(id: string): void {
  const existing = cache.get(id);
  if (existing) URL.revokeObjectURL(existing.objectUrl);
  cache.delete(id);
}

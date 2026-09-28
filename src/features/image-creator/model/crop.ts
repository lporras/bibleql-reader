import type { BackgroundCrop } from "./types";

export interface CoverRect {
  /** Pixel position/size of the (possibly oversized) image within the canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes the `object-fit: cover`-equivalent placement of a source image
 * inside a canvasWidth x canvasHeight box, then applies the project's
 * crop (extra zoom + pan) on top of it. All inputs/outputs are in pixels
 * for the given canvas size; callers on the normalized model multiply by
 * canvas.width/height first.
 */
export function coverRect(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  crop: BackgroundCrop
): CoverRect {
  const canvasAspect = canvasWidth / canvasHeight;
  const imageAspect = imageWidth / imageHeight;

  // Base "cover" scale: the smallest scale that makes the image fully
  // cover the canvas in both dimensions.
  const baseWidth = imageAspect > canvasAspect ? canvasHeight * imageAspect : canvasWidth;
  const baseHeight = imageAspect > canvasAspect ? canvasHeight : canvasWidth / imageAspect;

  const scale = Math.max(crop.scale, 1);
  const width = baseWidth * scale;
  const height = baseHeight * scale;

  // crop.x/crop.y are normalized pan offsets: 0 = image's top/left aligned
  // with canvas top/left, 1 = image's bottom/right aligned with canvas
  // bottom/right. This keeps panning well-defined regardless of scale.
  const maxOffsetX = width - canvasWidth;
  const maxOffsetY = height - canvasHeight;
  const x = -clamp01(crop.x) * maxOffsetX;
  const y = -clamp01(crop.y) * maxOffsetY;

  return { x, y, width, height };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

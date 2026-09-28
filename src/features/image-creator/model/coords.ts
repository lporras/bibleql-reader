// The one place the normalized (0..1) <-> pixel conversion is defined, so
// the editor preview and a later export renderer can't drift apart. A
// text element's fontSize is normalized to canvas *height*; every other
// geometric field is a fraction of the matching canvas dimension.

export interface PxRect {
  left: number;
  top: number;
  width: number;
}

export function toPxRect(norm: { x: number; y: number; width: number }, canvasWidth: number, canvasHeight: number): PxRect {
  return {
    left: norm.x * canvasWidth,
    top: norm.y * canvasHeight,
    width: norm.width * canvasWidth
  };
}

export function toNormalizedPosition(
  px: { left: number; top: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return { x: px.left / canvasWidth, y: px.top / canvasHeight };
}

export function fontSizePx(normalizedFontSize: number, canvasHeight: number): number {
  return normalizedFontSize * canvasHeight;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

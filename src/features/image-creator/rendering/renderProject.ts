import { getImageAsset } from "../assets/imageAssets";
import { coverRect } from "../model/crop";
import { fontSizePx } from "../model/coords";
import type { ImageCreatorProject, TextElement } from "../model/types";
import { wrapLines } from "./textLayout";

export type ExportFormat = "png" | "jpeg";

export interface RenderOptions {
  format: ExportFormat;
  /** 0..1, JPEG only. */
  jpegQuality?: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for a remote (Unsplash) background: without requesting a
    // CORS-mode fetch, a canvas that later draws this image becomes
    // "tainted" and export.toBlob()/getImageData() throw a
    // SecurityError, even though Unsplash's CDN itself sends permissive
    // Access-Control-Allow-Origin headers. Harmless no-op for local/
    // curated (same-origin) backgrounds.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function drawTextElement(ctx: CanvasRenderingContext2D, element: TextElement, canvasWidth: number, canvasHeight: number): void {
  const fontPx = fontSizePx(element.fontSize, canvasHeight);
  ctx.font = `${element.fontStyle} ${element.fontWeight} ${fontPx}px ${element.fontFamily}`;
  ctx.textBaseline = "top";
  ctx.textAlign = element.textAlign;
  ctx.globalAlpha = element.opacity;
  ctx.fillStyle = element.color;

  const boxLeft = element.x * canvasWidth;
  const boxWidth = element.width * canvasWidth;
  const boxTop = element.y * canvasHeight;
  const lineHeightPx = fontPx * element.lineHeight;

  const drawX = element.textAlign === "left" ? boxLeft : element.textAlign === "right" ? boxLeft + boxWidth : boxLeft + boxWidth / 2;

  const lines = wrapLines(ctx, element.text, boxWidth);
  lines.forEach((line, i) => {
    ctx.fillText(line, drawX, boxTop + i * lineHeightPx);
  });

  ctx.globalAlpha = 1;
}

/**
 * Deterministic export renderer: draws the same project the DOM editor
 * (EditorCanvas.tsx) previews, at exact target pixel dimensions, using
 * the same normalized-coordinate math (coverRect, fontSizePx) so the
 * exported image matches what was shown on screen. Independent of any
 * editor-only UI (selection rings, drag handles) by construction — it
 * never touches the DOM.
 */
export async function renderProject(project: ImageCreatorProject, options: RenderOptions): Promise<Blob> {
  const { width, height } = project.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Custom @font-face families must be loaded before fillText — otherwise
  // canvas silently falls back to the default font for that draw call.
  await document.fonts.ready;

  ctx.fillStyle = "#14120f";
  ctx.fillRect(0, 0, width, height);

  if (project.background) {
    const asset = getImageAsset(project.background.assetId);
    if (asset) {
      const img = await loadImage(asset.objectUrl);
      const rect = coverRect(asset.width, asset.height, width, height, project.background.crop);
      ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
    }

    if (project.background.overlay?.enabled) {
      ctx.fillStyle = project.background.overlay.color;
      ctx.globalAlpha = project.background.overlay.opacity;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  }

  for (const element of project.elements) {
    drawTextElement(ctx, element, width, height);
  }

  const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
  const quality = options.format === "jpeg" ? options.jpegQuality ?? 0.92 : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      },
      mimeType,
      quality
    );
  });
}

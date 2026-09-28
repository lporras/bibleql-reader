// Serializable project model for the Verse Image Creator (see
// `plan bible image.md` §6). Every geometric field is normalized to the
// 0..1 range as a fraction of canvas width/height (fontSize is a fraction
// of canvas *height*). That single choice is what lets the DOM editor
// preview and a later pixel-exact export renderer agree on layout at any
// canvas size, and makes switching between social presets a re-render
// rather than a re-layout.

export const PROJECT_VERSION = 1;

export type CanvasPreset =
  | "instagram-story"
  | "instagram-portrait"
  | "square"
  | "facebook-story"
  | "whatsapp-status"
  | "custom";

export interface CanvasSettings {
  preset: CanvasPreset;
  width: number;
  height: number;
}

export interface Attribution {
  photographerName: string;
  photographerUrl?: string;
  sourceName: string;
  sourceUrl?: string;
}

export interface BackgroundCrop {
  /** Normalized offset of the visible window into the source image, 0..1. */
  x: number;
  y: number;
  /** >= 1; 1 means the image is scaled to just cover the canvas. */
  scale: number;
}

export interface BackgroundOverlay {
  enabled: boolean;
  color: string;
  /** 0..0.7 per spec §9. */
  opacity: number;
}

export interface Background {
  type: "local" | "unsplash" | "curated";
  /** Key into the in-memory decoded-image cache (features/image-creator/assets). */
  assetId: string;
  /** Unsplash photo id — populated once the Unsplash provider lands, or for a curated image sourced from Unsplash. */
  sourceId?: string;
  fileName?: string;
  /** Intrinsic pixel dimensions of the source image. */
  width: number;
  height: number;
  /** Present only for externally sourced images; never stripped once set. */
  attribution?: Attribution;
  crop: BackgroundCrop;
  overlay?: BackgroundOverlay;
}

export type TextElementKind = "scripture" | "reference" | "custom";

export interface TextShadow {
  enabled: boolean;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface TextBackground {
  enabled: boolean;
  color: string;
  opacity: number;
  padding: number;
  radius: number;
}

export interface TextElement {
  id: string;
  kind: TextElementKind;
  text: string;

  /** Normalized top-left position and width; height is derived from text layout. */
  x: number;
  y: number;
  width: number;

  fontFamily: string;
  /** Normalized to canvas height. */
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";

  color: string;
  opacity: number;

  textAlign: "left" | "center" | "right";
  lineHeight: number;

  shadow?: TextShadow;
  background?: TextBackground;
}

export interface BibleSource {
  translationId: string;
  bookId: string;
  chapter: number;
  /** Sorted verse numbers; may be non-contiguous within the chapter. */
  verses: number[];
  reference: string;
}

export interface ImageCreatorProject {
  version: typeof PROJECT_VERSION;

  id: string;
  name: string;

  canvas: CanvasSettings;
  background: Background | null;
  bibleSource?: BibleSource;
  elements: TextElement[];

  createdAt: string;
  updatedAt: string;
}

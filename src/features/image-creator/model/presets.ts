import type { CanvasPreset, CanvasSettings } from "./types";

// Pixel dimensions per spec §14. Kept as plain data (not hard-coded into
// components) so a preset's numbers can be revised in one place.
export const SOCIAL_PRESETS: Record<Exclude<CanvasPreset, "custom">, { width: number; height: number }> = {
  "instagram-story": { width: 1080, height: 1920 },
  "instagram-portrait": { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  "facebook-story": { width: 1080, height: 1920 },
  "whatsapp-status": { width: 1080, height: 1920 }
};

// Brand/format names — left untranslated like translation identifiers
// elsewhere in the app (e.g. "eng-web"), since "Instagram Story" etc. are
// proper nouns, not UI copy.
export const PRESET_LABELS: Record<CanvasPreset, string> = {
  "instagram-story": "Instagram Story",
  "instagram-portrait": "Instagram Portrait",
  square: "Square",
  "facebook-story": "Facebook Story",
  "whatsapp-status": "WhatsApp Status",
  custom: "Custom"
};

export function canvasForPreset(preset: CanvasPreset, custom?: { width: number; height: number }): CanvasSettings {
  if (preset === "custom") {
    const size = custom ?? SOCIAL_PRESETS["instagram-portrait"];
    return { preset, width: size.width, height: size.height };
  }
  const size = SOCIAL_PRESETS[preset];
  return { preset, width: size.width, height: size.height };
}

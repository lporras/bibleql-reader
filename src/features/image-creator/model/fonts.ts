export type FontCategory = "serif" | "sans" | "display" | "mono";

export interface FontDefinition {
  id: string;
  label: string;
  family: string;
  category: FontCategory;
  weights: number[];
  /** True when backed by a bundled @font-face (styles/_fonts.scss); false
   *  for a font that only works if the OS happens to have it installed. */
  bundled: boolean;
}

function bundledFont(
  id: string,
  label: string,
  cssName: string,
  category: FontCategory,
  weights: number[],
  fallback: string
): FontDefinition {
  return { id, label, family: `'${cssName}', ${fallback}`, category, weights, bundled: true };
}

function systemFont(id: string, label: string, cssName: string, category: FontCategory, fallback: string): FontDefinition {
  return { id, label, family: `'${cssName}', ${fallback}`, category, weights: [400, 700], bundled: false };
}

// Bundled Google Fonts (spec §10), self-hosted under assets/fonts and
// declared via @font-face in styles/_fonts.scss — no network request at
// render time, so the editor works offline (spec §22). All are
// OFL-licensed and permit redistribution.
//
// Lora leads the list as the default: it's a warm, readable serif close
// to the look of YouVersion's Verse of the Day images, and it's already
// this app's body typeface ($font-body in styles/_tokens.scss), so
// scripture rendered in the editor matches scripture rendered in the
// Reader by default.
//
// The system fonts below aren't bundled — they render correctly only if
// the OS happens to have them (all four are pre-installed on both
// Windows and macOS, so this holds in practice for this desktop app).
// Users still can't type an arbitrary name (per spec): this is the full,
// fixed set of choices either way.
export const FONTS: FontDefinition[] = [
  bundledFont("lora", "Lora", "Lora", "serif", [400, 700], "Georgia, serif"),
  bundledFont("pt-serif", "PT Serif", "PT Serif", "serif", [400, 700], "Georgia, serif"),
  bundledFont("spectral", "Spectral", "Spectral", "serif", [400, 600, 700], "Georgia, serif"),
  systemFont("times-new-roman", "Times New Roman", "Times New Roman", "serif", "Times, serif"),
  bundledFont("playfair-display", "Playfair Display", "Playfair Display", "display", [400, 700], "Georgia, serif"),
  bundledFont("lobster", "Lobster", "Lobster", "display", [400], "cursive"),
  bundledFont("shrikhand", "Shrikhand", "Shrikhand", "display", [400], "cursive"),
  bundledFont("inter", "Inter", "Inter", "sans", [400, 500, 700], "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"),
  systemFont("helvetica", "Helvetica", "Helvetica", "sans", "Arial, sans-serif"),
  systemFont("verdana", "Verdana", "Verdana", "sans", "Geneva, sans-serif"),
  systemFont("trebuchet-ms", "Trebuchet MS", "Trebuchet MS", "sans", "sans-serif"),
  systemFont("courier-new", "Courier New", "Courier New", "mono", "Courier, monospace")
];

export const DEFAULT_FONT = FONTS[0];

export function findFont(id: string): FontDefinition {
  return FONTS.find((f) => f.id === id) ?? DEFAULT_FONT;
}

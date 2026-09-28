import { describe, expect, it } from "vitest";
import { canvasForPreset, SOCIAL_PRESETS } from "./presets";

describe("canvasForPreset", () => {
  it("returns the configured dimensions for each social preset", () => {
    for (const preset of Object.keys(SOCIAL_PRESETS) as (keyof typeof SOCIAL_PRESETS)[]) {
      const canvas = canvasForPreset(preset);
      expect(canvas).toEqual({ preset, ...SOCIAL_PRESETS[preset] });
    }
  });

  it("falls back to a default size for custom with no dimensions given", () => {
    const canvas = canvasForPreset("custom");
    expect(canvas.preset).toBe("custom");
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it("honors explicit custom dimensions", () => {
    const canvas = canvasForPreset("custom", { width: 800, height: 600 });
    expect(canvas).toEqual({ preset: "custom", width: 800, height: 600 });
  });
});

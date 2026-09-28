import { describe, expect, it } from "vitest";
import { coverRect } from "./crop";

describe("coverRect", () => {
  it("scales a wider-than-canvas image up to cover height, centered", () => {
    // 2000x1000 image (2:1) into a 1000x1000 canvas (1:1) — image is
    // wider than the canvas relative to height, so height is the
    // constraining dimension: cover height, overflow width.
    const rect = coverRect(2000, 1000, 1000, 1000, { x: 0.5, y: 0.5, scale: 1 });
    expect(rect.height).toBeCloseTo(1000);
    expect(rect.width).toBeCloseTo(2000);
    // Centered pan (x=0.5) should center the overflow.
    expect(rect.x).toBeCloseTo(-(rect.width - 1000) / 2);
    expect(rect.y).toBeCloseTo(0);
  });

  it("scales a taller-than-canvas image up to cover width, centered", () => {
    const rect = coverRect(1000, 2000, 1000, 1000, { x: 0.5, y: 0.5, scale: 1 });
    expect(rect.width).toBeCloseTo(1000);
    expect(rect.height).toBeCloseTo(2000);
    expect(rect.y).toBeCloseTo(-(rect.height - 1000) / 2);
    expect(rect.x).toBeCloseTo(0);
  });

  it("pans to the extremes when x/y are 0 or 1", () => {
    const rect = coverRect(2000, 1000, 1000, 1000, { x: 0, y: 0, scale: 1 });
    expect(rect.x).toBeCloseTo(0);

    const rectEnd = coverRect(2000, 1000, 1000, 1000, { x: 1, y: 0, scale: 1 });
    expect(rectEnd.x).toBeCloseTo(-(rectEnd.width - 1000));
  });

  it("applies extra zoom on top of the base cover scale", () => {
    const base = coverRect(2000, 1000, 1000, 1000, { x: 0.5, y: 0.5, scale: 1 });
    const zoomed = coverRect(2000, 1000, 1000, 1000, { x: 0.5, y: 0.5, scale: 2 });
    expect(zoomed.width).toBeCloseTo(base.width * 2);
    expect(zoomed.height).toBeCloseTo(base.height * 2);
  });

  it("clamps scale below 1 up to 1 (never shrinks below cover)", () => {
    const rect = coverRect(2000, 1000, 1000, 1000, { x: 0.5, y: 0.5, scale: 0.3 });
    expect(rect.height).toBeCloseTo(1000);
  });

  it("clamps out-of-range pan values into 0..1", () => {
    const rect = coverRect(2000, 1000, 1000, 1000, { x: -5, y: 5, scale: 1 });
    const rectAtZero = coverRect(2000, 1000, 1000, 1000, { x: 0, y: 1, scale: 1 });
    expect(rect).toEqual(rectAtZero);
  });
});

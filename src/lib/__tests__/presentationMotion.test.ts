import { describe, expect, it } from "vitest";
import { cameraArc, easeInOutCubic } from "@/lib/presentationMotion";

describe("briefing camera continuity", () => {
  it("joins exact endpoints without a jump, even for interrupted input", () => {
    for (const distance of [0, 0.1, 1, 5]) {
      expect(cameraArc(0, distance)).toBe(0);
      expect(cameraArc(1, distance)).toBeCloseTo(0, 12);
      expect(cameraArc(-1, distance)).toBe(0);
      expect(cameraArc(2, distance)).toBeCloseTo(0, 12);
    }
  });

  it("keeps the eased trajectory monotonic and inside its shot endpoints", () => {
    const values = Array.from({ length: 101 }, (_, i) => easeInOutCubic(i / 100));
    expect(values[0]).toBe(0);
    expect(values[100]).toBe(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      expect(values[i]).toBeLessThanOrEqual(1);
    }
  });

  it("uses symmetric easing in reverse and caps the camera detour", () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 12);
      expect(cameraArc(t, 100)).toBeLessThanOrEqual(0.42);
    }
  });
});

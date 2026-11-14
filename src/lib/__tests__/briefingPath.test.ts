import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { followScroll, sampleBriefingPose, storyFocus } from "@/lib/briefingPath";

describe("continuous briefing direction", () => {
  it("keeps both camera position and look target continuous across every chapter boundary", () => {
    for (let chapter = 1; chapter < 6; chapter++) {
      const before = new THREE.Vector3(), after = new THREE.Vector3();
      const lookBefore = new THREE.Vector3(), lookAfter = new THREE.Vector3();
      sampleBriefingPose(chapter - 0.00001, before, lookBefore);
      sampleBriefingPose(chapter + 0.00001, after, lookAfter);
      expect(before.distanceTo(after)).toBeLessThan(0.0001);
      expect(lookBefore.distanceTo(lookAfter)).toBeLessThan(0.0001);
    }
  });

  it("always blends exactly one unit of visual attention, including overview frames", () => {
    for (let i = 0; i <= 120; i++) {
      const focus = storyFocus(i / 20);
      expect(focus.overview + Object.values(focus.systems).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      expect(Object.values(focus.systems).every((v) => v >= 0 && v <= 1)).toBe(true);
    }
    expect(storyFocus(0).overview).toBe(1);
    expect(storyFocus(1).systems.neuro_ocular).toBe(1);
    expect(storyFocus(6).overview).toBe(1);
  });

  it("follows scroll without overshoot and with equal behavior at 30 and 60 fps", () => {
    let at30 = 0, at60 = 0;
    for (let i = 0; i < 30; i++) at30 = followScroll(at30, 4, 1 / 30);
    for (let i = 0; i < 60; i++) at60 = followScroll(at60, 4, 1 / 60);
    expect(at30).toBeCloseTo(at60, 10);
    expect(at60).toBeLessThan(4);
    expect(followScroll(4, 0, 1 / 60)).toBeGreaterThan(0);
  });
});

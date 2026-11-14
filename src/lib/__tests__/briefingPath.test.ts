import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { followScroll, sampleBriefingPose, storyFocus, storyScrollTarget, wrapStoryProgress, STORY_SYSTEMS } from "@/lib/briefingPath";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";

describe("continuous briefing direction", () => {
  it("keeps both camera position and look target continuous across every chapter boundary", () => {
    for (let chapter = 0; chapter <= 7; chapter++) {
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
    expect(storyFocus(1).overview).toBe(1);
    expect(storyFocus(2).systems.neuro_ocular).toBe(1);
    expect(storyFocus(6).systems.metabolic_endocrine).toBe(1);
  });

  it("keeps camera velocity and organ focus identical when rebasing either scroll seam", () => {
    const position = new THREE.Vector3(), wrappedPosition = new THREE.Vector3();
    const target = new THREE.Vector3(), wrappedTarget = new THREE.Vector3();
    for (const progress of [-1.001, -0.001, 6.999, 7.001, 14.25]) {
      sampleBriefingPose(progress, position, target);
      sampleBriefingPose(wrapStoryProgress(progress), wrappedPosition, wrappedTarget);
      expect(position.distanceTo(wrappedPosition)).toBeLessThan(1e-10);
      expect(target.distanceTo(wrappedTarget)).toBeLessThan(1e-10);
      expect(storyFocus(progress)).toEqual(storyFocus(wrapStoryProgress(progress)));
    }
    const before = new THREE.Vector3(), seam = new THREE.Vector3(), after = new THREE.Vector3();
    sampleBriefingPose(-0.00001, before, target);
    sampleBriefingPose(0, seam, target);
    sampleBriefingPose(0.00001, after, target);
    const incoming = seam.clone().sub(before).divideScalar(0.00001);
    const outgoing = after.clone().sub(seam).divideScalar(0.00001);
    expect(incoming.distanceTo(outgoing)).toBeLessThan(0.001);
    expect(storyScrollTarget(6, 0)).toBe(7);
    expect(storyScrollTarget(0, 6)).toBe(-1);
    expect(storyScrollTarget(6, 7)).toBe(7);
    expect(storyScrollTarget(0, -1)).toBe(-1);
  });

  it("starts with the title and keeps every camera chapter aligned with its slide", () => {
    expect(PRESENTATION_SLIDES).toHaveLength(7);
    expect(PRESENTATION_SLIDES[0].id).toBe("title");
    expect(PRESENTATION_SLIDES[6].id).toBe("metabolic-circadian");
    PRESENTATION_SLIDES.forEach((slide, index) => {
      expect(slide.cameraPreset).toBe(STORY_SYSTEMS[index] ?? "full");
      expect(slide.chapterCode).toBe(String(index + 1).padStart(2,"0"));
    });
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

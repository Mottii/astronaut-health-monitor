import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createChapterAtmosphere, sampleAtmosphere } from "@/lib/chapterAtmosphere";
import { PRESENTATION_ACCENTS } from "@/data/presentationTheme";

describe("chapter atmosphere", () => {
  it("blends through the last-to-first seam with the same state on repeated loops", () => {
    for (const progress of [-0.6, 0, 0.35, 5.9, 6.8, 7]) {
      const original = sampleAtmosphere(progress);
      const next = sampleAtmosphere(progress + 7);
      expect(next.left).toBe(original.left);
      expect(next.right).toBe(original.right);
      expect(next.blend).toBeCloseTo(original.blend, 10);
    }
  });

  it("covers every chapter including radiation, clears text areas, and respects reduced motion", () => {
    const atmosphere = createChapterAtmosphere(100, 1);
    const camera = new THREE.PerspectiveCamera(38, 1.7);
    camera.position.set(0, 0, 2.8);
    const target = new THREE.Vector3();
    for (let chapter = 0; chapter < 7; chapter++) {
      atmosphere.update(chapter, 4, camera, target, false);
      const opacity = atmosphere.points.material.uniforms.uOpacity.value;
      expect(opacity).toBeGreaterThan(0);
      expect(atmosphere.points.material.uniforms.uColour.value.getHexString()).toBe(PRESENTATION_ACCENTS[chapter].slice(1));
      expect(atmosphere.points.scale.x).toBeGreaterThan(0);
    }
    atmosphere.update(6.999999, 4, camera, target, false);
    const before = atmosphere.points.material.uniforms.uColour.value.clone();
    atmosphere.update(0.000001, 4, camera, target, false);
    const difference = before.sub(atmosphere.points.material.uniforms.uColour.value);
    expect(Math.abs(difference.r) + Math.abs(difference.g) + Math.abs(difference.b)).toBeLessThan(0.000001);
    atmosphere.update(0, 4, camera, target, true);
    expect(atmosphere.points.visible).toBe(false);
    camera.aspect = 0.6;
    atmosphere.update(0, 4, camera, target, false);
    expect(atmosphere.points.material.uniforms.uPortrait.value).toBe(1);
    atmosphere.points.geometry.dispose();
    atmosphere.points.material.dispose();
  });
});

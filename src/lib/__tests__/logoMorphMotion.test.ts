import { describe, expect, it } from "vitest";
import { logoAssemblyAtHeight, sampleLogoMorph } from "@/lib/logoMorphMotion";
import { buildBrandMarkGeometry } from "@/lib/aresLogoGeometry";
import { createCosmicLogoTransition } from "@/lib/cosmicLogoTransition";
import * as THREE from "three";

describe("cosmic logo to BioTwin transition", () => {
  it("keeps the same logo spin during descent and rest despite the body loading and turning", () => {
    const transition = createCosmicLogoTransition(120,1);
    const camera = new THREE.PerspectiveCamera();
    const emblem = transition.group.children.find((child) => child instanceof THREE.Group) as THREE.Group;
    const particles = transition.group.children.find((child) => child instanceof THREE.Points) as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
    let previousAngle = -0.2;
    let previousTime = 0;
    for (const time of [0.5,1,2,2.9,3.1,4,6]) {
      const bodyRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),time<2?0:0.5);
      transition.update(0,time,camera,bodyRotation,false,time);
      expect((emblem.rotation.y-previousAngle)/(time-previousTime)).toBeCloseTo(0.38,10);
      expect(transition.group.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
      expect(particles.material.uniforms.uBodyMatrix.value.elements).toEqual(new THREE.Matrix4().makeRotationFromQuaternion(bodyRotation).elements);
      previousAngle = emblem.rotation.y;
      previousTime = time;
    }
    // Dragging turns both the shell and its particles, including after a full scroll loop.
    const bodyRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),0.5);
    transition.update(0,6,camera,bodyRotation,false,6,0.8);
    expect(emblem.rotation.y-previousAngle).toBeCloseTo(0.8,10);
    expect(particles.material.uniforms.uLogoMatrix.value.elements).toEqual(emblem.matrix.elements);
    const draggedAngle = emblem.rotation.y;
    transition.update(7,7,camera,bodyRotation,false,7,0.8);
    expect(emblem.rotation.y-draggedAngle).toBeCloseTo(0.38,10);
    expect(particles.material.uniforms.uBodyMatrix.value.elements).toEqual(new THREE.Matrix4().makeRotationFromQuaternion(bodyRotation).elements);
    transition.update(7,7,camera,bodyRotation,true,7,0.8);
    expect(emblem.rotation.y).toBeCloseTo(-0.2+0.8,10);
    transition.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material)?child.material:[child.material];
        materials.forEach((material) => material.dispose());
      }
    });
  });
  it("assembles the apex before the middle and lower legs", () => {
    expect(logoAssemblyAtHeight(1,0.3)).toBe(1);
    expect(logoAssemblyAtHeight(0,0.3)).toBe(0);
    expect(logoAssemblyAtHeight(-1,0.3)).toBe(0);
    expect(logoAssemblyAtHeight(0,0.65)).toBe(1);
    expect(logoAssemblyAtHeight(-1,0.65)).toBe(0);
    for (const y of [-1,0,1]) expect(logoAssemblyAtHeight(y,1)).toBe(1);
  });
  it("emerges from mist before introducing the human model", () => {
    const first = sampleLogoMorph(0, 0);
    const settled = sampleLogoMorph(0, 4);
    expect(first.intro).toBe(0);
    expect(first.shell).toBe(0);
    expect(first.mist).toBe(1);
    expect(first.drop).toBeGreaterThan(settled.drop);
    expect(settled.shell).toBe(1);
    expect(settled.body).toBe(0);
    const middle = sampleLogoMorph(0.6, 4);
    expect(middle.morph).toBeGreaterThan(0.5);
    expect(middle.particles).toBeGreaterThan(0);
    expect(middle.body).toBeGreaterThan(0);
    expect(middle.drop).toBeLessThan(0);
    expect(sampleLogoMorph(1, 4).body).toBe(1);
    expect(sampleLogoMorph(1.1, 4).particles).toBe(0);
    expect(sampleLogoMorph(1.1, 4).mist).toBe(0);
  });

  it("has identical states across the infinite scroll seam and reverses with scroll", () => {
    for (const offset of [0, 0.1, 0.3, 0.6, 0.9, 1]) {
      const forward = sampleLogoMorph(offset, 4);
      const backward = sampleLogoMorph(7 - offset, 4);
      for (const key of Object.keys(forward) as Array<keyof typeof forward>) {
        expect(backward[key]).toBeCloseTo(forward[key], 10);
      }
    }
    expect(sampleLogoMorph(7, 4)).toEqual(sampleLogoMorph(0, 4));
    expect(sampleLogoMorph(0, 0, true).intro).toBe(1);
  });

  it("uses the real body surface as every particle's destination", () => {
    const transition = createCosmicLogoTransition(240, 1);
    const shell = new THREE.SphereGeometry(0.8, 24, 16);
    transition.setBodyGeometry(shell);
    const particles = transition.group.children.find((child) => child instanceof THREE.Points) as THREE.Points;
    const target = particles.geometry.getAttribute("aBody");
    expect(target.count).toBe(240);
    for (let i = 0; i < target.count; i++) {
      const radius = Math.hypot(target.getX(i), target.getY(i), target.getZ(i));
      expect(radius).toBeGreaterThan(0.78);
      expect(radius).toBeLessThanOrEqual(0.800001);
    }
    const camera = new THREE.PerspectiveCamera();
    transition.update(0, 4, camera, new THREE.Quaternion(), false);
    expect(transition.group.visible).toBe(true);
    transition.update(2, 4, camera, new THREE.Quaternion(), false);
    expect(transition.group.visible).toBe(false);
    shell.dispose();
    transition.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    });
  });

  it("retains all three parts of the existing extruded brand mark", () => {
    const parts = buildBrandMarkGeometry();
    expect(parts).toHaveLength(3);
    parts.forEach((part) => {
      part.computeBoundingBox();
      expect(part.boundingBox!.max.z - part.boundingBox!.min.z).toBeCloseTo(0.34, 5);
      part.dispose();
    });
  });
});

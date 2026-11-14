import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildShellEnvelope,
  containGeometryInsideShell,
  containGroupInsideShell,
} from "@/lib/shellContainment";

describe("shellContainment", () => {
  it("clamps vertices protruding outside a spherical shell inward with margin", () => {
    const shellGeo = new THREE.SphereGeometry(1.0, 32, 24);
    const envelope = buildShellEnvelope(shellGeo);
    expect(envelope).not.toBeNull();

    // Inner mesh extending 60mm outside radius 1.0
    const innerGeo = new THREE.SphereGeometry(1.06, 20, 14);
    const result = containGeometryInsideShell(innerGeo, envelope!, 0.05);

    expect(result.adjustedCount).toBe(innerGeo.getAttribute("position").count);
    expect(result.maxOriginalSignedDist).toBeGreaterThan(0.05);

    // Every vertex should now sit inside radius <= 0.98
    const pos = innerGeo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
      expect(r).toBeLessThanOrEqual(0.98);
    }

    shellGeo.dispose();
    innerGeo.dispose();
  });

  it("clamps transformed child meshes inside a THREE.Group in world space", () => {
    const shellGeo = new THREE.SphereGeometry(0.5, 24, 16);
    const envelope = buildShellEnvelope(shellGeo)!;

    const group = new THREE.Group();
    group.position.set(0.3, 0.0, 0.0);
    const boneGeo = new THREE.BoxGeometry(0.5, 0.1, 0.1, 3, 2, 2);
    const boneMesh = new THREE.Mesh(boneGeo);
    group.add(boneMesh);

    const adjusted = containGroupInsideShell(group, envelope, 0.02);
    expect(adjusted).toBeGreaterThan(0);

    group.updateMatrixWorld(true);
    const pos = boneGeo.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(boneMesh.matrixWorld);
      expect(v.length()).toBeLessThanOrEqual(0.5);
    }

    shellGeo.dispose();
    boneGeo.dispose();
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createOrbitalMist } from "@/lib/orbitalMist";

function dispose(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

describe("orbital mist volume", () => {
  it("casts from the camera in volume coordinates instead of turning a flat sprite to face it", () => {
    const mist = createOrbitalMist(80,1,false);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0,0,3);
    const volume = mist.group.children.find((child) => child instanceof THREE.Mesh) as THREE.Mesh<THREE.BoxGeometry,THREE.ShaderMaterial>;
    expect(volume.geometry.type).toBe("BoxGeometry");
    mist.update(0,1,1,0,0.2,camera);
    const localCamera = volume.material.uniforms.uCameraLocal.value.clone() as THREE.Vector3;
    expect(volume.localToWorld(localCamera).distanceTo(camera.position)).toBeLessThan(1e-6);
    const previousRotation = mist.group.quaternion.clone();
    mist.update(10,1,1,0,0.2,camera);
    expect(mist.group.quaternion.angleTo(previousRotation)).toBeGreaterThan(0.1);
    expect(volume.localToWorld(volume.material.uniforms.uCameraLocal.value.clone()).distanceTo(camera.position)).toBeLessThan(1e-6);
    dispose(mist.group);
  });
  it("keeps orbital seeds in 3D and hides the complete effect after the handoff", () => {
    const mist = createOrbitalMist(80,1,true);
    const camera = new THREE.PerspectiveCamera();
    camera.position.z = 3;
    const points = mist.group.children.find((child) => child instanceof THREE.Points) as THREE.Points;
    expect(points.geometry.getAttribute("aOrbit").count).toBe(80);
    mist.update(4,1,1,0,0.2,camera);
    expect(mist.group.visible).toBe(true);
    mist.update(4,1,0,1,0.2,camera);
    expect(mist.group.visible).toBe(false);
    dispose(mist.group);
  });
});

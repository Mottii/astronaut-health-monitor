import * as THREE from "three";

const BUCKET_STEP = 0.02;

export interface ShellEnvelope {
  positions: Float32Array;
  normals: Float32Array;
  vertexCount: number;
  yBuckets: Map<number, number[]>;
}

export interface ContainmentResult {
  adjustedCount: number;
  maxOriginalSignedDist: number;
}

/**
 * Builds a spatial Y-bucketed envelope from Outer_Body_Shell geometry
 * so internal organs and bones can be clamped strictly inside the skin silhouette.
 */
export function buildShellEnvelope(
  shellGeometry: THREE.BufferGeometry
): ShellEnvelope | null {
  const posAttr = shellGeometry.getAttribute("position");
  if (!posAttr || posAttr.count === 0) return null;

  if (!shellGeometry.getAttribute("normal")) {
    shellGeometry.computeVertexNormals();
  }
  const normAttr = shellGeometry.getAttribute("normal");
  if (!normAttr) return null;

  const vertexCount = posAttr.count;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const yBuckets = new Map<number, number[]>();

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    normals[i * 3] = normAttr.getX(i);
    normals[i * 3 + 1] = normAttr.getY(i);
    normals[i * 3 + 2] = normAttr.getZ(i);

    const yb = Math.round(y / BUCKET_STEP);
    let bucket = yBuckets.get(yb);
    if (!bucket) {
      bucket = [];
      yBuckets.set(yb, bucket);
    }
    bucket.push(i);
  }

  return { positions, normals, vertexCount, yBuckets };
}

function findNearestShellVertex(
  envelope: ShellEnvelope,
  vx: number,
  vy: number,
  vz: number
): number {
  const yb = Math.round(vy / BUCKET_STEP);
  const { positions, yBuckets } = envelope;
  let bestIdx = -1;
  let bestDistSq = Infinity;

  for (let dy = -2; dy <= 2; dy++) {
    const bucket = yBuckets.get(yb + dy);
    if (!bucket) continue;
    for (let k = 0; k < bucket.length; k++) {
      const si = bucket[k];
      const off = si * 3;
      const dx = vx - positions[off];
      const ddy = vy - positions[off + 1];
      const dz = vz - positions[off + 2];
      const d2 = dx * dx + ddy * ddy + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = si;
      }
    }
  }

  if (bestIdx !== -1) return bestIdx;

  // Fallback wider vertical search for extreme top/bottom vertices
  for (let dy = -6; dy <= 6; dy++) {
    if (Math.abs(dy) <= 2) continue;
    const bucket = yBuckets.get(yb + dy);
    if (!bucket) continue;
    for (let k = 0; k < bucket.length; k++) {
      const si = bucket[k];
      const off = si * 3;
      const dx = vx - positions[off];
      const ddy = vy - positions[off + 1];
      const dz = vz - positions[off + 2];
      const d2 = dx * dx + ddy * ddy + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = si;
      }
    }
  }

  if (bestIdx !== -1) return bestIdx;

  // Global fallback when a vertex lies outside the shell's vertical Y span
  for (let si = 0; si < envelope.vertexCount; si++) {
    const off = si * 3;
    const dx = vx - positions[off];
    const ddy = vy - positions[off + 1];
    const dz = vz - positions[off + 2];
    const d2 = dx * dx + ddy * ddy + dz * dz;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      bestIdx = si;
    }
  }

  return bestIdx;
}

/**
 * Clamps any vertex of `geometry` that lies outside or closer than `margin` meters
 * to the Outer_Body_Shell surface inward along the local skin normal.
 */
export function containGeometryInsideShell(
  geometry: THREE.BufferGeometry,
  envelope: ShellEnvelope,
  margin = 0.01,
  matrixWorld?: THREE.Matrix4
): ContainmentResult {
  const posAttr = geometry.getAttribute("position");
  if (!posAttr || posAttr.count === 0) {
    return { adjustedCount: 0, maxOriginalSignedDist: -Infinity };
  }

  const invMatrix = matrixWorld
    ? new THREE.Matrix4().copy(matrixWorld).invert()
    : null;
  const worldVec = new THREE.Vector3();
  const { positions, normals } = envelope;

  let adjustedCount = 0;
  let maxOriginalSignedDist = -Infinity;

  for (let i = 0; i < posAttr.count; i++) {
    worldVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    if (matrixWorld) {
      worldVec.applyMatrix4(matrixWorld);
    }

    const si = findNearestShellVertex(
      envelope,
      worldVec.x,
      worldVec.y,
      worldVec.z
    );
    if (si < 0) continue;

    const off = si * 3;
    const nx = normals[off];
    const ny = normals[off + 1];
    const nz = normals[off + 2];
    const signedDist =
      (worldVec.x - positions[off]) * nx +
      (worldVec.y - positions[off + 1]) * ny +
      (worldVec.z - positions[off + 2]) * nz;

    if (signedDist > maxOriginalSignedDist) {
      maxOriginalSignedDist = signedDist;
    }

    if (signedDist > -margin) {
      const push = signedDist + margin;
      worldVec.x -= nx * push;
      worldVec.y -= ny * push;
      worldVec.z -= nz * push;

      if (invMatrix) {
        worldVec.applyMatrix4(invMatrix);
      }
      posAttr.setXYZ(i, worldVec.x, worldVec.y, worldVec.z);
      adjustedCount++;
    }
  }

  if (adjustedCount > 0) {
    posAttr.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.computeVertexNormals();
  }

  return { adjustedCount, maxOriginalSignedDist };
}

/**
 * Convenience helper to clamp every Mesh inside a THREE.Group (e.g. aligned arm/clavicle bones).
 */
export function containGroupInsideShell(
  group: THREE.Object3D,
  envelope: ShellEnvelope,
  margin = 0.008
): number {
  group.updateMatrixWorld(true);
  let totalAdjusted = 0;
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      const res = containGeometryInsideShell(
        obj.geometry,
        envelope,
        margin,
        obj.matrixWorld
      );
      totalAdjusted += res.adjustedCount;
    }
  });
  return totalAdjusted;
}

import * as THREE from "three";

/**
 * Exact 3D counterpart of the ARES-MED header brand mark (`viewBox="0 0 32 32"`):
 * a chevron "A" sliced by an orbital arc into an upper apex and two lower legs.
 */
export function buildBrandMarkGeometry(): THREE.BufferGeometry[] {
  const to3D = (x: number, y: number): [number, number] => [
    (x - 16.0) / 11.0,
    (16.0 - y) / 11.0,
  ];

  const arcY = (x: number): number => {
    const t = (x - 4) / 25;
    return 21.0 * (1 - t) * (1 - t) + 2 * 13.6 * t * (1 - t) + 10.2 * t * t;
  };

  const arcSlope = (x: number): number => {
    const eps = 0.05;
    return (arcY(x + eps) - arcY(x - eps)) / (2 * eps);
  };

  const arcOffset = (x: number, d: number): [number, number] => {
    const dy = arcSlope(x);
    const len = Math.hypot(1, dy);
    return [x + (-dy / len) * d, arcY(x) + (1 / len) * d];
  };

  const intersectLineWithArcOffset = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    d: number,
  ): [number, number] => {
    const lineY = (x: number) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    let lo = Math.min(x1, x2);
    let hi = Math.max(x1, x2);
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) * 0.5;
      const fMid = lineY(mid) - (arcY(mid) + d * Math.hypot(1, arcSlope(mid)));
      const fLo = lineY(lo) - (arcY(lo) + d * Math.hypot(1, arcSlope(lo)));
      if ((fMid >= 0) === (fLo >= 0)) lo = mid;
      else hi = mid;
    }
    const x = (lo + hi) * 0.5;
    return [x, lineY(x)];
  };

  const HALF_GAP = 1.25;
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.34,
    // Crisp front/back contours keep the hollow volume legible at title-card scale.
    bevelEnabled: false,
    curveSegments: 28,
  };

  const sampleArc = (xStart: number, xEnd: number, d: number, steps = 10): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 1; i < steps; i++) {
      const x = xStart + ((xEnd - xStart) * i) / steps;
      pts.push(arcOffset(x, d));
    }
    return pts;
  };

  const makePart = (svgPts: [number, number][]): THREE.ExtrudeGeometry => {
    const shape = new THREE.Shape();
    svgPts.forEach(([x, y], idx) => {
      const [px, py] = to3D(x, y);
      if (idx === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    });
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.translate(0, 0, -0.17);
    geom.computeVertexNormals();
    return geom;
  };

  const uOL = intersectLineWithArcOffset(4, 26, 14.5, 6, -HALF_GAP);
  const uIL = intersectLineWithArcOffset(9.2, 26, 16.5, 11.4, -HALF_GAP);
  const uIR = intersectLineWithArcOffset(16.5, 11.4, 23.2, 26, -HALF_GAP);
  const uOR = intersectLineWithArcOffset(18.5, 6, 28, 26, -HALF_GAP);

  const apexGeom = makePart([
    uOL,
    [14.5, 6],
    [18.5, 6],
    uOR,
    ...sampleArc(uOR[0], uIR[0], -HALF_GAP),
    uIR,
    [16.5, 11.4],
    uIL,
    ...sampleArc(uIL[0], uOL[0], -HALF_GAP),
  ]);

  const lOL = intersectLineWithArcOffset(4, 26, 14.5, 6, HALF_GAP);
  const lIL = intersectLineWithArcOffset(9.2, 26, 16.5, 11.4, HALF_GAP);
  const leftLegGeom = makePart([
    [4, 26],
    lOL,
    ...sampleArc(lOL[0], lIL[0], HALF_GAP),
    lIL,
    [9.2, 26],
  ]);

  const lIR = intersectLineWithArcOffset(16.5, 11.4, 23.2, 26, HALF_GAP);
  const lOR = intersectLineWithArcOffset(18.5, 6, 28, 26, HALF_GAP);
  const rightLegGeom = makePart([
    [23.2, 26],
    lIR,
    ...sampleArc(lIR[0], lOR[0], HALF_GAP),
    lOR,
    [28, 26],
  ]);

  return [apexGeom, leftLegGeom, rightLegGeom];
}

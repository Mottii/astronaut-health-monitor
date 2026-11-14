"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export interface AresLogo3DProps {
  className?: string;
  reducedMotion?: boolean;
}

const HOLO_VERTEX_SHADER = `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Matches BioTwin3DStage's translucent X-ray/hologram body shell shader.
const HOLO_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 1.75);

    float scanline = 0.5 + 0.5 * sin(vWorldPos.y * 140.0 - uTime * 1.4);
    float sweepY = mod(uTime * 0.45, 2.6) - 1.3;
    float sweep = exp(-abs(vWorldPos.y - sweepY) * 14.0) * 0.42;

    vec3 obsidianBase = vec3(0.025, 0.032, 0.048);
    vec3 cyanRim = vec3(0.32, 0.80, 0.98);
    vec3 silverRim = vec3(0.90, 0.95, 1.0);
    vec3 rimCol = mix(cyanRim, silverRim, smoothstep(0.12, 0.82, fresnel));

    vec3 col = mix(obsidianBase, rimCol, fresnel * 0.96);
    col += vec3(0.78, 0.86, 0.94) * sweep * (0.4 + fresnel * 0.65);
    col += vec3(0.06, 0.11, 0.16) * scanline * fresnel;

    float alpha = clamp(mix(0.035, 0.56, fresnel) + sweep * 0.1, 0.035, 0.68);
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * Exact 3D counterpart of the ARES-MED header brand mark (`viewBox="0 0 32 32"`):
 * a chevron "A" sliced by an orbital arc into an upper apex and two lower legs.
 */
function buildBrandMarkGeometry(): THREE.BufferGeometry[] {
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
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.032,
    bevelSegments: 6,
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
    geom.translate(0, 0, -0.14);
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

export function AresLogo3D({ className, reducedMotion = false }: AresLogo3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 108;
    const height = host.clientHeight || 108;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 30);
    camera.position.set(0, 0, 6.2);
    camera.lookAt(0, 0, 0);

    const geometries = buildBrandMarkGeometry();
    const uniforms = { uTime: { value: 0 } };

    const holoMat = new THREE.ShaderMaterial({
      vertexShader: HOLO_VERTEX_SHADER,
      fragmentShader: HOLO_FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const edgeGeometries: THREE.EdgesGeometry[] = [];
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xd4e2ec,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    const group = new THREE.Group();
    geometries.forEach((geom) => {
      group.add(new THREE.Mesh(geom, holoMat));
      const edges = new THREE.EdgesGeometry(geom, 42);
      edgeGeometries.push(edges);
      group.add(new THREE.LineSegments(edges, edgeMat));
    });
    scene.add(group);

    let rafId = 0;
    let disposed = false;
    let inView = true;
    let lastTime = performance.now();
    let angle = 0;

    const renderFrame = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      uniforms.uTime.value = now * 0.001;

      if (!reducedMotion) {
        angle += dt * 0.68;
        group.rotation.y = angle;
        group.rotation.x = Math.sin(now * 0.001) * 0.04;
      } else {
        group.rotation.y = 0;
        group.rotation.x = 0;
      }

      renderer.render(scene, camera);

      if (!reducedMotion && inView && !document.hidden) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const start = () => {
      cancelAnimationFrame(rafId);
      lastTime = performance.now();
      rafId = requestAnimationFrame(renderFrame);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView && !document.hidden) start();
        else cancelAnimationFrame(rafId);
      },
      { threshold: 0.05 },
    );
    observer.observe(host);

    const onVisibility = () => {
      if (!document.hidden && inView) start();
      else cancelAnimationFrame(rafId);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width === 0 || rect.height === 0) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    resizeObserver.observe(host);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      geometries.forEach((g) => g.dispose());
      edgeGeometries.forEach((e) => e.dispose());
      holoMat.dispose();
      edgeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reducedMotion]);

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label="ARES-MED 3D emblem"
    />
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildBrandMarkGeometry } from "@/lib/aresLogoGeometry";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

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

// Only grazing surfaces catch light: front faces stay empty, like a hollow hologram.
const HOLO_FRAGMENT_SHADER = `
  uniform float uTime;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 3.2);

    float scanline = 0.5 + 0.5 * sin(vWorldPos.y * 140.0 - uTime * 1.4);
    float sweepY = mod(uTime * 0.45, 2.6) - 1.3;
    float sweep = exp(-abs(vWorldPos.y - sweepY) * 18.0);

    vec3 rimCol = vec3(1.0);

    float alpha = fresnel * (0.10 + scanline * 0.025 + sweep * 0.06);
    gl_FragColor = vec4(rimCol, alpha);
  }
`;


export function AresLogo3D({ className, reducedMotion = false }: AresLogo3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 108;
    const height = host.clientHeight || 108;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setReady(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 30);
    camera.position.set(0, 0, 5.5);
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
      blending: THREE.AdditiveBlending,
    });

    const edgeGeometries: THREE.EdgesGeometry[] = [];
    const lineGeometries: LineSegmentsGeometry[] = [];
    // Layer screen-space contours to create a soft halo without filling the mark.
    const lineMaterials = [
      { width: 8, opacity: 0.025, color: 0xffffff },
      { width: 3, opacity: 0.10, color: 0xffffff },
      { width: 1, opacity: 0.82, color: 0xffffff },
    ].map(({ width: lineWidth, opacity, color }) => {
      const material = new LineMaterial({
        color, opacity, transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      material.linewidth = lineWidth;
      material.resolution.set(width, height);
      return material;
    });

    const group = new THREE.Group();
    geometries.forEach((geom) => {
      group.add(new THREE.Mesh(geom, holoMat));
      const edges = new THREE.EdgesGeometry(geom, 35);
      edgeGeometries.push(edges);
      const lineGeometry = new LineSegmentsGeometry();
      lineGeometry.setPositions(edges.getAttribute("position").array as Float32Array);
      lineGeometries.push(lineGeometry);
      lineMaterials.forEach((material) => {
        const lines = new LineSegments2(lineGeometry, material);
        lines.frustumCulled = false;
        group.add(lines);
      });
    });
    scene.add(group);

    let rafId = 0;
    let disposed = false;
    let inView = true;

    const renderFrame = (now: number) => {
      if (disposed) return;
      // All loop copies share the same phase, so the emblem never jumps at a scroll seam.
      const elapsed = reducedMotion ? 0 : now * 0.001;

      if (!reducedMotion) {
        group.rotation.y = -0.35 + Math.sin(elapsed * 0.42) * 0.6;
        group.rotation.x = -0.08 + Math.sin(elapsed * 0.38) * 0.09;
      } else {
        group.rotation.y = -0.35;
        group.rotation.x = -0.08;
      }
      uniforms.uTime.value = elapsed;

      renderer.render(scene, camera);

      if (!reducedMotion && inView && !document.hidden) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const start = () => {
      cancelAnimationFrame(rafId);
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
      lineMaterials.forEach((material) => material.resolution.set(rect.width, rect.height));
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    resizeObserver.observe(host);

    start();
    setReady(true);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      geometries.forEach((g) => g.dispose());
      edgeGeometries.forEach((e) => e.dispose());
      lineGeometries.forEach((geometry) => geometry.dispose());
      holoMat.dispose();
      lineMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reducedMotion]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-ready={ready}
      role="img"
      aria-label="ARES-MED hollow 3D emblem with glowing edges"
    >
      <svg className="ares-logo-fallback" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="0.65" strokeLinejoin="round">
          <path d="M8 30 18.5 10h4L32 30h-4.8l-6.7-14.6L13.2 30H8Z" opacity=".3" />
          <path d="M4 26 14.5 6h4L28 26h-4.8l-6.7-14.6L9.2 26H4Z" />
          <path d="m4 26 4 4m6.5-24 4 4m0-4 4 4M28 26l4 4m-8.8-4 4 4m-10.7-18.6 4 4M9.2 26l4 4" opacity=".6" />
        </g>
        <path d="M5 20.5C11.5 14 20.5 11 29 9.5" stroke="#06070a" strokeWidth="2.5" />
      </svg>
    </div>
  );
}

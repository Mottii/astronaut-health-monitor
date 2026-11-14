"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BODY_SYSTEM_METADATA } from "@/data/nasaHrpData";
import type {
  BodySystemId,
  CascadeLink,
  EnvironmentTelemetry,
  SelectedSubStructure,
  SystemAssessment,
  TelemetryMode,
  TriageStatus,
  VitalReadings,
} from "@/types/health";

export type ClinicalVisualMode = "atlas" | "xray" | "vascular";

export interface BioTwin3DStageProps {
  assessments: Record<BodySystemId, SystemAssessment>;
  cascades: CascadeLink[];
  selectedSystem: BodySystemId;
  onSelectSystem: (systemId: BodySystemId) => void;
  onSelectSubStructure?: (info: SelectedSubStructure) => void;
  vitals?: VitalReadings;
  envTelemetry?: EnvironmentTelemetry;
  telemetryMode?: TelemetryMode;
  hardwareSourceLabel?: string;
  visualMode?: ClinicalVisualMode;
  /** Optional legacy prop kept for backward compatibility. */
  xrayIntensity?: "normal" | "deep";
  autoRotate: boolean;
  cameraResetToken: number;
}

interface ParsedSubStructure {
  systemId: BodySystemId;
  layer: "Shell" | "Core";
  tissueTag: string;
  structureLabel: string;
  isSystemicSpan: boolean;
}

interface SubMeshEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  meta: ParsedSubStructure;
  baseColor: THREE.Color;
}

interface HoveredStructureInfo {
  systemId: BodySystemId;
  layer: "Shell" | "Core";
  tissueTag: string;
  structureLabel: string;
}

const SYSTEM_ORDER: BodySystemId[] = [
  "neuro_ocular",
  "behavioral_circadian",
  "cardiovascular",
  "immune_hematology",
  "metabolic_endocrine",
  "musculoskeletal_renal",
];

const SYSTEM_KEY_MAP: Record<string, BodySystemId> = {
  NeuroOcular: "neuro_ocular",
  BehavioralCircadian: "behavioral_circadian",
  Cardiovascular: "cardiovascular",
  ImmuneHematology: "immune_hematology",
  MetabolicEndocrine: "metabolic_endocrine",
  MusculoskeletalRenal: "musculoskeletal_renal",
};

const SYSTEM_BASE_HEX: Record<BodySystemId, string> = {
  neuro_ocular: "#2dd4bf",
  behavioral_circadian: "#818cf8",
  cardiovascular: "#fb7185",
  immune_hematology: "#c084fc",
  metabolic_endocrine: "#f97316",
  musculoskeletal_renal: "#4ade80",
};

const TISSUE_COLOR_HEX: Record<string, string> = {
  Myocardium: "#e11d48",
  Valve: "#f8fafc",
  Artery: "#ef4444",
  Vein: "#3b82f6",
  Parenchyma: "#c084fc",
  Airway: "#e2e8f0",
  Lymphoid: "#a855f7",
  Cortex: "#38bdf8",
  Ventricle: "#22d3ee",
  Neural: "#60a5fa",
  Ocular: "#2dd4bf",
  Endocrine: "#818cf8",
  Hepatic: "#d97706",
  Ligament: "#fcd34d",
  Gland: "#f59e0b",
  GI: "#fb923c",
  RenalCortex: "#34d399",
  RenalMedulla: "#f43f5e",
  Urinary: "#10b981",
  Bone: "#e7e5e4",
};

const DEFAULT_STRUCTURE_BY_SYSTEM: Record<BodySystemId, HoveredStructureInfo> = {
  neuro_ocular: {
    systemId: "neuro_ocular",
    layer: "Core",
    tissueTag: "Ocular",
    structureLabel: "Optic Chiasm & Cerebral Ventricles",
  },
  behavioral_circadian: {
    systemId: "behavioral_circadian",
    layer: "Core",
    tissueTag: "Endocrine",
    structureLabel: "Pineal Body & Suprachiasmatic Nucleus",
  },
  cardiovascular: {
    systemId: "cardiovascular",
    layer: "Core",
    tissueTag: "Valve",
    structureLabel: "Mitral, Aortic Valves & Systemic Vasculature",
  },
  immune_hematology: {
    systemId: "immune_hematology",
    layer: "Core",
    tissueTag: "Airway",
    structureLabel: "Intrapulmonary Bronchial Tree & Thymus",
  },
  metabolic_endocrine: {
    systemId: "metabolic_endocrine",
    layer: "Core",
    tissueTag: "Hepatic",
    structureLabel: "Hepatic Portal Lobe, Pancreas & GI Tract",
  },
  musculoskeletal_renal: {
    systemId: "musculoskeletal_renal",
    layer: "Core",
    tissueTag: "RenalMedulla",
    structureLabel: "Renal Pyramids, Ureters & Bony Pelvis",
  },
};

const STATUS_COLOR_HEX: Record<TriageStatus, string> = {
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
};

// Anatomical world-space anchors in glTF Y-up space (aligned to NIH Visible Human Male skin.glb)
const ORGAN_ANCHORS: Record<BodySystemId, THREE.Vector3> = {
  neuro_ocular: new THREE.Vector3(0.032, 0.812, 0.055),
  behavioral_circadian: new THREE.Vector3(-0.025, 0.832, 0.005),
  cardiovascular: new THREE.Vector3(0.020, 0.476, 0.038),
  immune_hematology: new THREE.Vector3(-0.068, 0.504, 0.005),
  metabolic_endocrine: new THREE.Vector3(-0.038, 0.365, 0.015),
  musculoskeletal_renal: new THREE.Vector3(0.068, 0.295, -0.022),
};

// Optimal inspection camera offset per organ system
const ORGAN_CAMERA_VIEWS: Record<
  BodySystemId,
  { target: THREE.Vector3; position: THREE.Vector3 }
> = {
  neuro_ocular: {
    target: new THREE.Vector3(0.0, 0.815, 0.015),
    position: new THREE.Vector3(0.22, 0.84, 0.72),
  },
  behavioral_circadian: {
    target: new THREE.Vector3(0.0, 0.83, 0.005),
    position: new THREE.Vector3(-0.24, 0.88, 0.72),
  },
  cardiovascular: {
    target: new THREE.Vector3(0.015, 0.48, 0.025),
    position: new THREE.Vector3(0.24, 0.52, 0.86),
  },
  immune_hematology: {
    target: new THREE.Vector3(0.0, 0.50, 0.005),
    position: new THREE.Vector3(-0.26, 0.54, 0.94),
  },
  metabolic_endocrine: {
    target: new THREE.Vector3(-0.01, 0.32, 0.02),
    position: new THREE.Vector3(-0.26, 0.38, 0.96),
  },
  musculoskeletal_renal: {
    target: new THREE.Vector3(0.0, 0.20, -0.01),
    position: new THREE.Vector3(0.32, 0.28, 1.18),
  },
};

const FULL_BODY_VIEW = {
  target: new THREE.Vector3(0.0, 0.0, 0.0),
  position: new THREE.Vector3(0.18, 0.12, 2.85),
};

const FRESNEL_VERTEX_SHADER = `
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

const FRESNEL_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uXrayDeep;
  uniform vec3 uFocusPos;
  uniform vec3 uAccentColor;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.45);

    // Subtle surgical scanlines + slow vertical telemetry sweep
    float scanline = 0.5 + 0.5 * sin(vWorldPos.y * 165.0 - uTime * 1.6);
    float sweepY = mod(uTime * 0.42, 2.1) - 1.0;
    float sweep = exp(-abs(vWorldPos.y - sweepY) * 26.0);

    // Spherical X-Ray window centered around inspected organ
    float distToFocus = distance(vWorldPos, uFocusPos);
    float focusWindow = smoothstep(0.10, 0.36, distToFocus);

    vec3 obsidianBase = vec3(0.035, 0.04, 0.055);
    vec3 silverRim = vec3(0.84, 0.89, 0.96);
    vec3 col = mix(obsidianBase, silverRim, fresnel * 0.88);
    col += uAccentColor * (sweep * 0.24 + (1.0 - focusWindow) * fresnel * 0.20);
    col += vec3(0.035) * scanline * fresnel;

    float baseAlpha = mix(0.028, 0.52, fresnel);
    float cutoutAlpha = mix(0.22, 1.0, focusWindow);
    float depthFactor = mix(1.0, 0.44, uXrayDeep);
    float alpha = clamp(baseAlpha * cutoutAlpha * depthFactor + sweep * 0.05, 0.015, 0.68);

    gl_FragColor = vec4(col, alpha);
  }
`;

function formatStructureLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\bAnd\b/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOrganNodeName(name: string): ParsedSubStructure | null {
  if (!name.startsWith("Organ_")) return null;
  const parts = name.split("__");
  const systemKey = parts[0].replace(/^Organ_/, "");
  const systemId = SYSTEM_KEY_MAP[systemKey];
  if (!systemId) return null;

  const layer = parts[1] === "Shell" ? "Shell" : "Core";
  const tissueTag = parts[2] ?? "Neural";
  const structureLabel = formatStructureLabel(parts.slice(3).join(" ") || systemKey);

  // Systemic body-spanning trees stay unscaled in world space so cardiac/lung pulses stay strictly local
  const isSystemicSpan =
    tissueTag === "Artery" ||
    tissueTag === "Vein" ||
    tissueTag === "Bone" ||
    tissueTag === "GI" ||
    tissueTag === "Urinary" ||
    name.includes("Spinal_Cord") ||
    name.includes("Lymphatic_Network");

  return {
    systemId,
    layer,
    tissueTag,
    structureLabel,
    isSystemicSpan,
  };
}

interface LiveStateSnapshot {
  assessments: Record<BodySystemId, SystemAssessment>;
  selectedSystem: BodySystemId;
  vitals?: VitalReadings;
  envTelemetry?: EnvironmentTelemetry;
  effectiveMode: ClinicalVisualMode;
  autoRotate: boolean;
  hoveredMeshName: string | null;
}

export function BioTwin3DStage({
  assessments,
  cascades,
  selectedSystem,
  onSelectSystem,
  onSelectSubStructure,
  vitals,
  envTelemetry,
  telemetryMode = "preset",
  hardwareSourceLabel,
  visualMode,
  xrayIntensity = "normal",
  autoRotate,
  cameraResetToken,
}: BioTwin3DStageProps) {
  const effectiveMode: ClinicalVisualMode =
    visualMode ?? (xrayIntensity === "deep" ? "xray" : "atlas");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Record<BodySystemId, HTMLButtonElement | null>>({
    neuro_ocular: null,
    behavioral_circadian: null,
    cardiovascular: null,
    immune_hematology: null,
    metabolic_endocrine: null,
    musculoskeletal_renal: null,
  });

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [hoveredInfo, setHoveredInfo] = useState<HoveredStructureInfo | null>(null);
  const [clickedInfo, setClickedInfo] = useState<HoveredStructureInfo | null>(null);
  const [isHoveringOrgan, setIsHoveringOrgan] = useState(false);

  const hoveredMeshNameRef = useRef<string | null>(null);

  // Refs synced to animation loop without re-initializing WebGL scene
  const liveRef = useRef<LiveStateSnapshot>({
    assessments,
    selectedSystem,
    vitals,
    envTelemetry,
    effectiveMode,
    autoRotate,
    hoveredMeshName: null,
  });
  liveRef.current = {
    assessments,
    selectedSystem,
    vitals,
    envTelemetry,
    effectiveMode,
    autoRotate,
    hoveredMeshName: hoveredMeshNameRef.current,
  };

  const onSelectRef = useRef(onSelectSystem);
  onSelectRef.current = onSelectSystem;

  const onSelectSubStructureRef = useRef(onSelectSubStructure);
  onSelectSubStructureRef.current = onSelectSubStructure;

  const cascadesRef = useRef<CascadeLink[]>(cascades);
  cascadesRef.current = cascades;
  const rebuildCascadesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setClickedInfo((prev) =>
      prev && prev.systemId === selectedSystem
        ? prev
        : DEFAULT_STRUCTURE_BY_SYSTEM[selectedSystem]
    );
  }, [selectedSystem]);

  // Camera transition state (skip auto fly-to on very first mount so user sees full body)
  const mountedSelectionRef = useRef(false);
  const flyRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  }>({
    active: false,
    targetPos: FULL_BODY_VIEW.position.clone(),
    targetLook: FULL_BODY_VIEW.target.clone(),
  });

  // Trigger camera fly-to when user changes selectedSystem after mount
  useEffect(() => {
    if (!mountedSelectionRef.current) {
      mountedSelectionRef.current = true;
      return;
    }
    const view = ORGAN_CAMERA_VIEWS[selectedSystem];
    flyRef.current = {
      active: true,
      targetPos: view.position.clone(),
      targetLook: view.target.clone(),
    };
  }, [selectedSystem]);

  // Trigger full-body camera reset when cameraResetToken increments
  useEffect(() => {
    if (cameraResetToken === 0) return;
    flyRef.current = {
      active: true,
      targetPos: FULL_BODY_VIEW.position.clone(),
      targetLook: FULL_BODY_VIEW.target.clone(),
    };
  }, [cameraResetToken]);

  // Rebuild 3D cascade spline conduits whenever active cascades change
  useEffect(() => {
    rebuildCascadesRef.current?.();
  }, [cascades]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setLoadState("error");
      return;
    }

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 360);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "block h-full w-full";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 30);
    camera.position.copy(FULL_BODY_VIEW.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(FULL_BODY_VIEW.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.55;
    controls.maxDistance = 4.2;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.minPolarAngle = Math.PI * 0.08;
    controls.update();

    const cancelFlyOnUserDrag = () => {
      flyRef.current.active = false;
    };
    controls.addEventListener("start", cancelFlyOnUserDrag);

    // Surgical dark-studio lighting rig
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(1.8, 2.4, 2.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x94a3b8, 0.9);
    rimLight.position.set(-2.0, 1.5, -1.8);
    scene.add(rimLight);

    const underFill = new THREE.PointLight(0x38bdf8, 0.45, 4.5);
    underFill.position.set(0, -1.1, 0.8);
    scene.add(underFill);

    // Architectural concentric floor grid rings under feet (skin soles sit at y = -0.913)
    const floorGroup = new THREE.Group();
    floorGroup.position.y = -0.915;
    for (const [radius, opacity] of [
      [0.34, 0.16],
      [0.54, 0.09],
      [0.74, 0.05],
    ]) {
      const ringGeo = new THREE.RingGeometry(radius - 0.0025, radius, 72);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      floorGroup.add(new THREE.Mesh(ringGeo, ringMat));
    }
    scene.add(floorGroup);

    // Custom Fresnel X-Ray ShaderMaterial for Outer_Body_Shell
    const shellMaterial = new THREE.ShaderMaterial({
      vertexShader: FRESNEL_VERTEX_SHADER,
      fragmentShader: FRESNEL_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uXrayDeep: { value: 0 },
        uFocusPos: { value: ORGAN_ANCHORS[liveRef.current.selectedSystem].clone() },
        uAccentColor: { value: new THREE.Color("#2dd4bf") },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    const skeletonMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#cbd5e1"),
      roughness: 0.55,
      metalness: 0.08,
      clearcoat: 0.2,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });

    const pulseGroups: Record<BodySystemId, THREE.Group> = {
      neuro_ocular: new THREE.Group(),
      behavioral_circadian: new THREE.Group(),
      cardiovascular: new THREE.Group(),
      immune_hematology: new THREE.Group(),
      metabolic_endocrine: new THREE.Group(),
      musculoskeletal_renal: new THREE.Group(),
    };
    for (const sysId of SYSTEM_ORDER) {
      pulseGroups[sysId].position.copy(ORGAN_ANCHORS[sysId]);
      scene.add(pulseGroups[sysId]);
    }

    const systemSubMeshes: Record<BodySystemId, SubMeshEntry[]> = {
      neuro_ocular: [],
      behavioral_circadian: [],
      cardiovascular: [],
      immune_hematology: [],
      metabolic_endocrine: [],
      musculoskeletal_renal: [],
    };
    const allSubMeshes: SubMeshEntry[] = [];
    const organPickTargets: THREE.Object3D[] = [];

    // Telemetry Particle Systems
    // 1) Cephalad Fluid Shift (Carotid upward flow)
    const fluidCount = 48;
    const fluidPositions = new Float32Array(fluidCount * 3);
    const fluidGeo = new THREE.BufferGeometry();
    fluidGeo.setAttribute("position", new THREE.BufferAttribute(fluidPositions, 3));
    const fluidMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.014,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const fluidPoints = new THREE.Points(fluidGeo, fluidMat);
    scene.add(fluidPoints);

    // 2) Ionizing Radiation SPE Streaks
    const radCount = 40;
    const radPositions = new Float32Array(radCount * 3);
    const radSeeds = Array.from({ length: radCount }, (_, i) => ({
      x: ((i * 37) % 100) / 100 - 0.5,
      y: ((i * 53) % 100) / 100 * 1.5 - 0.65,
      z: ((i * 71) % 100) / 100 - 0.5,
      speed: 0.55 + ((i * 19) % 10) * 0.08,
    }));
    const radGeo = new THREE.BufferGeometry();
    radGeo.setAttribute("position", new THREE.BufferAttribute(radPositions, 3));
    const radMat = new THREE.PointsMaterial({
      color: 0xc084fc,
      size: 0.015,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const radPoints = new THREE.Points(radGeo, radMat);
    scene.add(radPoints);

    // 3) Bone-to-Kidney Calcium Ion Stream
    const caCount = 36;
    const caPositions = new Float32Array(caCount * 3);
    const caGeo = new THREE.BufferGeometry();
    caGeo.setAttribute("position", new THREE.BufferAttribute(caPositions, 3));
    const caMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.013,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const caPoints = new THREE.Points(caGeo, caMat);
    scene.add(caPoints);

    // 3D Cascade Spline Conduit Group
    const cascadeGroup = new THREE.Group();
    scene.add(cascadeGroup);
    const activeCascadeAnimators: Array<{
      curve: THREE.CatmullRomCurve3;
      pulseMesh: THREE.Mesh;
      speedOffset: number;
    }> = [];

    const rebuildCascades = () => {
      while (cascadeGroup.children.length > 0) {
        const child = cascadeGroup.children[0];
        cascadeGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      activeCascadeAnimators.length = 0;

      cascadesRef.current.forEach((cascade, idx) => {
        const fromPos = ORGAN_ANCHORS[cascade.fromSystem];
        const toPos = ORGAN_ANCHORS[cascade.toSystem];
        const mid = fromPos.clone().add(toPos).multiplyScalar(0.5);
        // Bow outward anteriorly & slightly laterally so conduit is clearly visible
        mid.z += 0.14;
        mid.x += idx % 2 === 0 ? 0.08 : -0.08;

        const curve = new THREE.CatmullRomCurve3([
          fromPos.clone(),
          mid,
          toPos.clone(),
        ]);
        const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.005, 8, false);
        const colorHex = cascade.severity === "red" ? 0xf87171 : 0xfbbf24;
        const tubeMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.55,
        });
        cascadeGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

        const pulseGeo = new THREE.SphereGeometry(0.013, 12, 12);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        cascadeGroup.add(pulseMesh);

        activeCascadeAnimators.push({
          curve,
          pulseMesh,
          speedOffset: idx * 0.27,
        });
      });
    };

    rebuildCascadesRef.current = rebuildCascades;
    rebuildCascades();

    // Load Blender-exported multi-layer clinical GLB
    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(
      "/models/ares-biotwin.glb",
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        root.updateMatrixWorld(true);

        const meshesToProcess: THREE.Mesh[] = [];
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            meshesToProcess.push(obj);
          }
        });

        for (const obj of meshesToProcess) {
          // Bake glTF hierarchy transform into geometry so world positions match ORGAN_ANCHORS
          obj.geometry.applyMatrix4(obj.matrixWorld);
          obj.position.set(0, 0, 0);
          obj.rotation.set(0, 0, 0);
          obj.scale.set(1, 1, 1);
          obj.updateMatrix();

          if (obj.name === "Outer_Body_Shell") {
            obj.material = shellMaterial;
            obj.renderOrder = 10;
            scene.add(obj);
            continue;
          }
          if (obj.name === "Skeletal_Frame") {
            obj.material = skeletonMaterial;
            obj.renderOrder = 2;
            scene.add(obj);
            continue;
          }

          const parsed = parseOrganNodeName(obj.name);
          if (!parsed) continue;

          const sysId = parsed.systemId;
          const isShell = parsed.layer === "Shell";
          const baseHex = TISSUE_COLOR_HEX[parsed.tissueTag] ?? SYSTEM_BASE_HEX[sysId];
          const baseColor = new THREE.Color(baseHex);
          const baseOpacity = isShell
            ? 0.72
            : parsed.tissueTag === "Artery" || parsed.tissueTag === "Vein"
              ? 0.88
              : 0.95;

          const mat = new THREE.MeshPhysicalMaterial({
            color: baseColor.clone(),
            emissive: baseColor.clone(),
            emissiveIntensity: isShell ? 0.18 : 0.34,
            roughness: isShell ? 0.36 : 0.26,
            metalness: 0.08,
            clearcoat: 0.4,
            clearcoatRoughness: 0.24,
            transparent: true,
            opacity: baseOpacity,
            depthWrite: !isShell,
            side: isShell ? THREE.FrontSide : THREE.DoubleSide,
          });

          obj.material = mat;
          obj.userData = { systemId: sysId, parsed };
          obj.renderOrder = isShell ? 6 : 4;

          if (parsed.isSystemicSpan) {
            scene.add(obj);
          } else {
            // Re-center local organ geometry around its anatomical anchor so pulse scaling stays strictly in-place
            const anchor = ORGAN_ANCHORS[sysId];
            obj.geometry.translate(-anchor.x, -anchor.y, -anchor.z);
            pulseGroups[sysId].add(obj);
          }

          const entry: SubMeshEntry = {
            mesh: obj,
            material: mat,
            meta: parsed,
            baseColor,
          };
          systemSubMeshes[sysId].push(entry);
          allSubMeshes.push(entry);
          organPickTargets.push(obj);
        }

        setLoadState("ready");
      },
      undefined,
      () => {
        if (!disposed) setLoadState("error");
      }
    );

    // Raycasting for surgical hover & click picking across Shell and nested Core sub-structures
    const raycaster = new THREE.Raycaster();
    const pointerDownPos = new THREE.Vector2();
    const pointerNdc = new THREE.Vector2();

    const pickSubStructure = (
      clientX: number,
      clientY: number
    ): { mesh: THREE.Mesh; parsed: ParsedSubStructure } | null => {
      if (organPickTargets.length === 0) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(organPickTargets, false);
      if (hits.length === 0) return null;

      const firstDist = hits[0].distance;
      const coreHit = hits.find(
        (h) =>
          h.distance - firstDist < 0.14 &&
          (h.object.userData.parsed as ParsedSubStructure | undefined)?.layer === "Core"
      );
      const chosen = coreHit ?? hits[0];
      const parsed = chosen.object.userData.parsed as ParsedSubStructure | undefined;
      if (!parsed || !(chosen.object instanceof THREE.Mesh)) return null;
      return { mesh: chosen.object, parsed };
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos.set(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const hit = pickSubStructure(e.clientX, e.clientY);
      const nextName = hit ? hit.mesh.name : null;
      if (nextName === hoveredMeshNameRef.current) return;

      hoveredMeshNameRef.current = nextName;
      if (hit) {
        setIsHoveringOrgan(true);
        setHoveredInfo({
          systemId: hit.parsed.systemId,
          layer: hit.parsed.layer,
          tissueTag: hit.parsed.tissueTag,
          structureLabel: hit.parsed.structureLabel,
        });
      } else {
        setIsHoveringOrgan(false);
        setHoveredInfo(null);
      }
    };

    const handlePointerLeave = () => {
      if (hoveredMeshNameRef.current === null) return;
      hoveredMeshNameRef.current = null;
      setIsHoveringOrgan(false);
      setHoveredInfo(null);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (moved > 6) return;

      const hit = pickSubStructure(e.clientX, e.clientY);
      if (hit) {
        setClickedInfo({
          systemId: hit.parsed.systemId,
          layer: hit.parsed.layer,
          tissueTag: hit.parsed.tissueTag,
          structureLabel: hit.parsed.structureLabel,
        });
        onSelectRef.current(hit.parsed.systemId);
        onSelectSubStructureRef.current?.({
          systemId: hit.parsed.systemId,
          nodeName: hit.mesh.name,
          displayLabel: hit.parsed.structureLabel,
          layer: hit.parsed.layer,
          tissueTag: hit.parsed.tissueTag,
        });
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    // ResizeObserver for crisp canvas sizing
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(entry.contentRect.width, 280);
      const h = Math.max(entry.contentRect.height, 340);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    // Smooth animation loop
    const clock = new THREE.Clock();
    const projectedVec = new THREE.Vector3();
    const targetColor = new THREE.Color();
    const statusColorObj = new THREE.Color();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const snapshot = liveRef.current;

      // Update camera fly-to interpolation or OrbitControls autoRotate
      if (flyRef.current.active) {
        const lerpAlpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(flyRef.current.targetPos, lerpAlpha);
        controls.target.lerp(flyRef.current.targetLook, lerpAlpha);
        if (
          camera.position.distanceTo(flyRef.current.targetPos) < 0.008 &&
          controls.target.distanceTo(flyRef.current.targetLook) < 0.008
        ) {
          flyRef.current.active = false;
        }
      }

      controls.autoRotate = snapshot.autoRotate && !flyRef.current.active;
      controls.autoRotateSpeed = 0.85;
      controls.update();

      // Update Outer Shell Fresnel shader + skeletal opacity from active clinical viewing mode
      const effectiveMode = snapshot.effectiveMode;
      shellMaterial.uniforms.uTime.value = t;
      shellMaterial.uniforms.uXrayDeep.value =
        effectiveMode === "xray"
          ? 1.0
          : effectiveMode === "vascular"
            ? 0.88
            : 0.0;
      skeletonMaterial.opacity =
        effectiveMode === "xray"
          ? 0.26
          : effectiveMode === "vascular"
            ? 0.11
            : 0.2;
      shellMaterial.uniforms.uFocusPos.value.lerp(
        ORGAN_ANCHORS[snapshot.selectedSystem],
        0.15
      );
      const focusStatus = snapshot.assessments[snapshot.selectedSystem].status;
      targetColor.set(
        focusStatus === "green"
          ? SYSTEM_BASE_HEX[snapshot.selectedSystem]
          : STATUS_COLOR_HEX[focusStatus]
      );
      shellMaterial.uniforms.uAccentColor.value.lerp(targetColor, 0.12);

      // Update dual-layer anatomical sub-structures + physiological organ pulses
      const hrHz = (snapshot.vitals?.heartRateBpm ?? 68) / 60.0;
      const co2 = snapshot.envTelemetry?.cabinCo2MmHg ?? 2.8;
      const radMsv = snapshot.envTelemetry?.dailyRadiationMsv ?? 0.5;
      const hydrationMl = snapshot.vitals?.hydrationMl ?? 2550;

      for (const sysId of SYSTEM_ORDER) {
        const assessment = snapshot.assessments[sysId];
        const isSelected = snapshot.selectedSystem === sysId;
        const group = pulseGroups[sysId];

        let pulse = 0;
        if (sysId === "cardiovascular") {
          // Double-peak systolic/diastolic cardiac cycle at exact HR bpm
          const phase = (t * hrHz) % 1.0;
          const lub = Math.exp(-Math.pow((phase - 0.14) * 11.0, 2.0));
          const dub = 0.6 * Math.exp(-Math.pow((phase - 0.34) * 12.0, 2.0));
          pulse = lub + dub;
          group.scale.setScalar(1.0 + pulse * 0.055);
        } else if (sysId === "immune_hematology") {
          // Thoracic respiratory lung cycle (~0.22 Hz)
          const breath = 0.5 + 0.5 * Math.sin(t * 1.4);
          pulse = breath * (radMsv > 1.2 ? 0.9 : 0.35);
          group.scale.set(
            1.0 + breath * 0.025,
            1.0 + breath * 0.015,
            1.0 + breath * 0.03
          );
        } else if (sysId === "neuro_ocular") {
          // Optic nerve & cranial pressure pulse amplified by high CO2 / SANS alert
          const sansAmp = co2 > 3.2 || assessment.status !== "green" ? 1.0 : 0.25;
          pulse = (0.5 + 0.5 * Math.sin(t * 2.8)) * sansAmp;
          group.scale.setScalar(1.0 + pulse * 0.022);
        } else if (sysId === "behavioral_circadian") {
          // Circadian neural corona rotation/shimmer
          pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + 1.1);
          group.rotation.y = Math.sin(t * 0.5) * 0.06;
        } else {
          pulse =
            assessment.status === "red"
              ? 0.5 + 0.5 * Math.sin(t * 4.2)
              : 0.5 + 0.5 * Math.sin(t * 1.6);
          group.scale.setScalar(
            1.0 + (assessment.status !== "green" ? pulse * 0.028 : 0.0)
          );
        }

        statusColorObj.set(STATUS_COLOR_HEX[assessment.status]);

        for (const entry of systemSubMeshes[sysId]) {
          const isShell = entry.meta.layer === "Shell";
          const isVascularTissue =
            entry.meta.tissueTag === "Artery" ||
            entry.meta.tissueTag === "Vein" ||
            entry.meta.tissueTag === "Lymphoid" ||
            entry.meta.tissueTag === "Myocardium" ||
            entry.meta.tissueTag === "Valve";
          const preserveAnatomicalHue =
            entry.meta.tissueTag === "Artery" ||
            entry.meta.tissueTag === "Vein" ||
            entry.meta.tissueTag === "Valve" ||
            entry.meta.tissueTag === "Airway";

          if (assessment.status === "green") {
            targetColor.copy(entry.baseColor);
          } else {
            const alertBlend = isShell
              ? 0.62
              : preserveAnatomicalHue
                ? 0.14
                : 0.42;
            targetColor.copy(entry.baseColor).lerp(statusColorObj, alertBlend);
          }
          entry.material.color.lerp(targetColor, 0.14);
          entry.material.emissive.lerp(targetColor, 0.14);

          let targetOpacity = isShell
            ? 0.72
            : entry.meta.tissueTag === "Artery" || entry.meta.tissueTag === "Vein"
              ? 0.88
              : 0.95;
          if (effectiveMode === "xray") {
            targetOpacity = isShell ? 0.26 : 0.98;
          } else if (effectiveMode === "vascular") {
            targetOpacity = isVascularTissue ? (isShell ? 0.38 : 0.98) : 0.08;
          }
          entry.material.opacity += (targetOpacity - entry.material.opacity) * 0.16;
          entry.material.depthWrite = entry.material.opacity >= 0.72;
          entry.mesh.renderOrder = isVascularTissue && effectiveMode === "vascular" ? 8 : isShell ? 6 : 4;

          const dimNonVascular = effectiveMode === "vascular" && !isVascularTissue;
          const baseEmissive = dimNonVascular
            ? 0.05
            : isSelected
              ? isShell
                ? 0.34
                : 0.68
              : assessment.status === "green"
                ? isShell
                  ? 0.18
                  : 0.34
                : 0.48;
          entry.material.emissiveIntensity = dimNonVascular
            ? baseEmissive
            : baseEmissive +
              pulse * (isSelected || assessment.status !== "green" ? 0.5 : 0.18);
        }
      }

      // Highlight hovered anatomical sub-structure from live raycast
      for (const entry of allSubMeshes) {
        if (entry.mesh.name === snapshot.hoveredMeshName) {
          entry.material.emissiveIntensity = Math.min(
            1.65,
            entry.material.emissiveIntensity + 0.45
          );
        }
      }

      // Update Cephalad Fluid Shift Particles along bilateral carotids (heart -> brain)
      const fAttr = fluidGeo.getAttribute("position") as THREE.BufferAttribute;
      const fluidIntensity = co2 > 3.4 || snapshot.assessments.neuro_ocular.status !== "green" ? 1.0 : 0.45;
      fluidMat.opacity = 0.25 + fluidIntensity * 0.55;
      fluidMat.color.set(co2 > 3.5 ? 0xf87171 : 0x38bdf8);
      for (let i = 0; i < fluidCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const p = ((t * (0.28 + fluidIntensity * 0.22) + i / fluidCount) % 1.0);
        const y = 0.48 + p * 0.35;
        const x = side * (0.024 + Math.sin(p * Math.PI) * 0.008);
        const z = 0.02 - p * 0.01;
        fAttr.setXYZ(i, x, y, z);
      }
      fAttr.needsUpdate = true;

      // Update Ionizing Radiation SPE Streaks
      const rAttr = radGeo.getAttribute("position") as THREE.BufferAttribute;
      const radActive = radMsv > 1.2 || snapshot.assessments.immune_hematology.status !== "green";
      radMat.opacity = radActive ? Math.min(0.85, 0.25 + (radMsv - 0.8) * 0.22) : 0.08;
      for (let i = 0; i < radCount; i++) {
        const seed = radSeeds[i];
        const prog = ((t * seed.speed + i * 0.13) % 1.0) - 0.5;
        rAttr.setXYZ(
          i,
          seed.x * 0.55 + prog * 0.45,
          seed.y - prog * 0.35,
          seed.z * 0.35
        );
      }
      rAttr.needsUpdate = true;

      // Update Bone-to-Kidney Calcium Ion Stream
      const cAttr = caGeo.getAttribute("position") as THREE.BufferAttribute;
      const caActive =
        hydrationMl < 2100 ||
        !(snapshot.vitals?.aredExerciseCompleted ?? true) ||
        snapshot.assessments.musculoskeletal_renal.status !== "green";
      caMat.opacity = caActive ? 0.82 : 0.0;
      if (caActive) {
        for (let i = 0; i < caCount; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const p = (t * 0.36 + i / caCount) % 1.0;
          // Flow from lumbar spine/kidneys down ureters toward bladder
          const x = side * (0.068 * (1 - p * 0.65));
          const y = 0.30 - p * 0.26;
          const z = -0.015 + p * 0.045;
          cAttr.setXYZ(i, x, y, z);
        }
        cAttr.needsUpdate = true;
      }

      // Animate 3D Domino Cascade Pulse Spheres along spline tubes
      for (const anim of activeCascadeAnimators) {
        const u = (t * 0.55 + anim.speedOffset) % 1.0;
        const pos = anim.curve.getPointAt(u);
        anim.pulseMesh.position.copy(pos);
      }

      renderer.render(scene, camera);

      // Project 3D organ anchors to 2D callout pill positions via refs (zero React re-renders)
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      for (const sysId of SYSTEM_ORDER) {
        const pillEl = pillRefs.current[sysId];
        if (!pillEl) continue;
        projectedVec.copy(ORGAN_ANCHORS[sysId]).project(camera);
        if (
          projectedVec.z > 1 ||
          Math.abs(projectedVec.y) > 0.94 ||
          Math.abs(projectedVec.x) > 0.96
        ) {
          pillEl.style.opacity = "0";
          pillEl.style.pointerEvents = "none";
          continue;
        }
        pillEl.style.pointerEvents = "auto";
        const px = (projectedVec.x * 0.5 + 0.5) * cw;
        const py = (-projectedVec.y * 0.5 + 0.5) * ch;
        const isLeftSide = projectedVec.x < 0;
        const offsetX = isLeftSide ? -108 : 16;
        const clampedX = Math.max(8, Math.min(cw - 116, px + offsetX));
        const clampedY = Math.max(10, Math.min(ch - 28, py - 11));
        pillEl.style.opacity = "1";
        pillEl.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
      }
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", cancelFlyOnUserDrag);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const activeHudInfo =
    hoveredInfo ?? clickedInfo ?? DEFAULT_STRUCTURE_BY_SYSTEM[selectedSystem];
  const hudAccentHex =
    TISSUE_COLOR_HEX[activeHudInfo.tissueTag] ??
    SYSTEM_BASE_HEX[activeHudInfo.systemId];

  return (
    <div
      ref={containerRef}
      className={`relative h-[440px] w-full min-w-0 overflow-hidden rounded-2xl lg:h-full ${
        isHoveringOrgan
          ? "cursor-crosshair"
          : "cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* Subtle architectural crosshair background behind WebGL alpha canvas */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.035) 0%, rgba(10,10,10,0) 68%)",
        }}
      />

      {loadState === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-white/10 bg-[#141414]/90 px-4 py-1.5 font-mono text-xs text-[#7e828a]">
            Initializing 3D BioTwin Mesh...
          </span>
        </div>
      )}

      {loadState === "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-300">
            WebGL unavailable — switch to 2D Blueprint mode
          </span>
        </div>
      )}

      {/* Live Hardware / Hybrid Overlay Telemetry Link HUD */}
      {loadState === "ready" && telemetryMode !== "preset" && (
        <div
          data-testid="live-hardware-hud"
          className="pointer-events-none absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-[#0b1018]/90 px-3 py-1 font-mono text-[10px] text-cyan-200 shadow-lg backdrop-blur-md"
        >
          <span
            className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"
            style={{
              animationDuration: `${Math.max(
                0.35,
                60 / Math.max(40, vitals?.heartRateBpm ?? 68)
              ).toFixed(2)}s`,
            }}
          />
          <span className="font-semibold uppercase tracking-wider text-white">
            {telemetryMode === "live_hardware"
              ? "LIVE HARDWARE"
              : "HYBRID OVERLAY"}
          </span>
          <span className="text-[#8b909a]">·</span>
          <span className="truncate text-cyan-300">
            {hardwareSourceLabel ?? "CSA ASTROSKIN / ISS ETHOS"}
          </span>
          <span className="text-[#8b909a]">·</span>
          <span className="font-semibold text-rose-300 tabular-nums">
            {vitals?.heartRateBpm ?? 68} BPM SYNC
          </span>
        </div>
      )}

      {/* Surgical Sub-Structure Raycast HUD */}
      {loadState === "ready" && (
        <div
          data-testid="surgical-hud-readout"
          className="pointer-events-none absolute right-3 bottom-3 left-3 z-20 max-w-[360px] rounded-xl border border-white/10 bg-[#0d0e11]/90 px-3 py-2 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8b909a]">
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: hudAccentHex }}
              />
              {hoveredInfo ? "RAYCAST TARGET" : "ACTIVE SUB-STRUCTURE"}
            </span>
            <span className="shrink-0 whitespace-nowrap rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8.5px] text-white/80">
              {activeHudInfo.layer} · {activeHudInfo.tissueTag}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-white">
            {activeHudInfo.structureLabel}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-[#7e828a]">
            {BODY_SYSTEM_METADATA[activeHudInfo.systemId].shortLabel}
          </p>
        </div>
      )}

      {/* Projected 3D-to-2D Organ Callout Pills */}
      {loadState === "ready" &&
        SYSTEM_ORDER.map((systemId) => {
          const meta = BODY_SYSTEM_METADATA[systemId];
          const assessment = assessments[systemId];
          const isSelected = selectedSystem === systemId;
          const shortTitle = meta.shortLabel.split(" / ")[0].toUpperCase();
          const dotColor =
            assessment.status === "green"
              ? SYSTEM_BASE_HEX[systemId]
              : STATUS_COLOR_HEX[assessment.status];

          return (
            <button
              key={systemId}
              ref={(el) => {
                pillRefs.current[systemId] = el;
              }}
              type="button"
              onClick={() => onSelectSystem(systemId)}
              style={{ opacity: 0 }}
              className={`absolute top-0 left-0 z-10 inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 font-mono text-[9.5px] font-semibold backdrop-blur-md transition-colors ${
                isSelected
                  ? "border-white bg-white text-[#0a0a0a] shadow-lg"
                  : "border-white/15 bg-[#141414]/85 text-white hover:border-white/35"
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              <span>{shortTitle}</span>
              <span className={isSelected ? "text-[#0a0a0a]/75" : "text-[#7e828a]"}>
                {assessment.score}
              </span>
            </button>
          );
        })}
    </div>
  );
}

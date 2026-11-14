"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
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
  /** Optional explicit camera target ("full" or specific organ) for presentation mode */
  cameraPreset?: "full" | BodySystemId;
  /** Enable subtle cursor parallax on the 3D camera */
  enableParallax?: boolean;
  /** Allow mouse-wheel zoom on OrbitControls (disable during scroll presentation) */
  allowWheelZoom?: boolean;
  /** Hide bottom-left surgical raycast card (used when PresentationView draws its own corner HUD) */
  hideBottomHud?: boolean;
  /** Control which 3D organ callout pills are visible */
  calloutFilter?: "all" | "selected" | "none";
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
  neuro_ocular: "#4e9e9a",
  behavioral_circadian: "#747eb8",
  cardiovascular: "#a85c6b",
  immune_hematology: "#8a70ad",
  metabolic_endocrine: "#a6754e",
  musculoskeletal_renal: "#579977",
};

const TISSUE_COLOR_HEX: Record<string, string> = {
  Myocardium: "#c4455b",   // deep ruby myocardium
  Valve: "#cbd5e1",        // pearlescent valve leaflets
  Artery: "#cf5353",       // oxygenated arterial crimson
  Vein: "#3b76b8",         // deoxygenated venous cobalt
  Parenchyma: "#7c88c4",   // soft indigo-lavender lung parenchyma
  Airway: "#94a3b8",       // cool slate trachea/bronchi
  Lymphoid: "#9b6bc2",     // violet spleen & lymph nodes
  Cortex: "#3ea6c2",       // crisp cyan cerebral cortex
  Ventricle: "#38bdf8",    // bright aqua CSF ventricles
  Neural: "#5e82ad",       // steel-blue spinal cord
  Ocular: "#2dd4bf",       // teal optic chiasm & globes
  Endocrine: "#818cf8",    // periwinkle pineal/pituitary
  Hepatic: "#a85143",      // warm terracotta liver
  Ligament: "#b59b5c",     // muted ochre ligaments
  Gland: "#d49a45",        // amber-gold pancreas/adrenals
  GI: "#c9864c",           // warm bronze stomach & colon
  RenalCortex: "#2ea885",  // emerald-teal renal cortex
  RenalMedulla: "#b85c72", // rose-plum renal pyramids
  Urinary: "#3c9984",      // sea-green ureters & bladder
  Bone: "#94a3b8",         // unified X-ray slate bone
};

function resolveStructureColorHex(parsed: ParsedSubStructure): string {
  const label = parsed.structureLabel;
  if (parsed.systemId === "metabolic_endocrine") {
    if (label.includes("Small Intestine")) return "#d97757";      // warm coral-peach small bowel
    if (label.includes("Large Intestine")) return "#7ca368";      // distinct sage-olive colon
    if (label.includes("Pancreas")) return "#e0a838";             // amber-gold pancreas
    if (label.includes("Caudate")) return "#c95842";              // copper-red caudate/porta
    if (label.includes("Parenchyma")) return "#8c3b36";           // deep mahogany liver lobes
    if (label.includes("Ligament")) return "#d6c38b";             // pale gold hepatic ligaments
  }
  return TISSUE_COLOR_HEX[parsed.tissueTag] ?? SYSTEM_BASE_HEX[parsed.systemId];
}

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

// Optimal inspection camera offset per organ system (slightly lowered target.y so organs sit cleanly above bottom slide titles)
const ORGAN_CAMERA_VIEWS: Record<
  BodySystemId,
  { target: THREE.Vector3; position: THREE.Vector3 }
> = {
  neuro_ocular: {
    target: new THREE.Vector3(0.0, 0.77, 0.015),
    position: new THREE.Vector3(0.22, 0.82, 0.76),
  },
  behavioral_circadian: {
    target: new THREE.Vector3(0.0, 0.785, 0.005),
    position: new THREE.Vector3(-0.24, 0.85, 0.76),
  },
  cardiovascular: {
    target: new THREE.Vector3(0.015, 0.43, 0.025),
    position: new THREE.Vector3(0.24, 0.49, 0.90),
  },
  immune_hematology: {
    target: new THREE.Vector3(0.0, 0.45, 0.005),
    position: new THREE.Vector3(-0.26, 0.51, 0.96),
  },
  metabolic_endocrine: {
    target: new THREE.Vector3(-0.01, 0.27, 0.02),
    position: new THREE.Vector3(-0.26, 0.34, 0.98),
  },
  musculoskeletal_renal: {
    target: new THREE.Vector3(0.0, 0.15, -0.01),
    position: new THREE.Vector3(0.32, 0.24, 1.20),
  },
};

const FULL_BODY_VIEW = {
  target: new THREE.Vector3(0.0, -0.04, 0.0),
  position: new THREE.Vector3(0.18, 0.10, 2.90),
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
    float fresnel = pow(1.0 - ndotv, 2.25);

    // Dual surgical scanlines + holographic topographic micro-grid
    float scanline = 0.5 + 0.5 * sin(vWorldPos.y * 190.0 - uTime * 1.8);
    float gridY = smoothstep(0.92, 0.99, abs(sin(vWorldPos.y * 42.0)));
    float gridX = smoothstep(0.94, 0.995, abs(sin(vWorldPos.x * 42.0 + vWorldPos.z * 42.0)));
    float holoGrid = max(gridY, gridX) * 0.28;

    float sweepY = mod(uTime * 0.45, 2.2) - 1.05;
    float sweep = exp(-abs(vWorldPos.y - sweepY) * 28.0);

    // Spherical X-Ray window centered around inspected organ
    float distToFocus = distance(vWorldPos, uFocusPos);
    float focusWindow = smoothstep(0.08, 0.34, distToFocus);

    vec3 obsidianBase = vec3(0.025, 0.032, 0.048);
    vec3 cyanRim = vec3(0.28, 0.78, 0.98);
    vec3 silverRim = vec3(0.88, 0.94, 1.0);
    vec3 rimCol = mix(cyanRim, silverRim, fresnel);
    vec3 col = mix(obsidianBase, rimCol, fresnel * 0.92);
    col += uAccentColor * (sweep * 0.32 + (1.0 - focusWindow) * fresnel * 0.28);
    col += rimCol * holoGrid * (0.35 + fresnel * 0.65);
    col += vec3(0.05, 0.09, 0.14) * scanline * fresnel;

    float baseAlpha = mix(0.018, 0.54, fresnel) + holoGrid * 0.08;
    float cutoutAlpha = mix(0.14, 1.0, focusWindow);
    float depthFactor = mix(1.0, 0.42, uXrayDeep);
    float alpha = clamp(baseAlpha * cutoutAlpha * depthFactor + sweep * 0.06, 0.012, 0.72);

    gl_FragColor = vec4(col, alpha);
  }
`;

const NEBULA_VERTEX_SHADER = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uAccentColor;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    float waveA = sin(vDir.x * 4.5 + uTime * 0.12) * cos(vDir.y * 3.8 - uTime * 0.09);
    float waveB = sin((vDir.z + vDir.y) * 6.0 + uTime * 0.16);
    float neb = clamp(0.5 + 0.35 * waveA + 0.25 * waveB, 0.0, 1.0);

    vec3 deepSpace = vec3(0.022, 0.026, 0.038);
    vec3 indigoMist = vec3(0.045, 0.075, 0.14);
    vec3 col = mix(deepSpace, indigoMist, pow(neb, 2.0));
    col += uAccentColor * (0.045 * pow(neb, 3.0) * (1.0 - abs(vDir.y)));

    // Subtle crisp starfield
    vec3 cell = floor(vDir * 145.0);
    float star = step(0.994, hash(cell));
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.8 + hash(cell) * 24.0);
    col += vec3(0.75, 0.88, 1.0) * star * twinkle * 0.42;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const PARTICLE_SHELL_VERTEX = `
  uniform float uTime;
  uniform vec3 uFocusPos;
  varying float vFocusGlow;

  void main() {
    vec3 pos = position;
    float wave = sin(pos.y * 12.0 + uTime * 1.7 + pos.x * 8.0) * 0.0025;
    pos += normal * wave;

    float dist = distance(pos, uFocusPos);
    vFocusGlow = 1.0 - smoothstep(0.05, 0.32, dist);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp((2.6 + vFocusGlow * 2.2) / max(-mvPos.z, 0.45), 1.4, 5.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_SHELL_FRAGMENT = `
  uniform vec3 uAccentColor;
  varying float vFocusGlow;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.08, d) * (0.34 + vFocusGlow * 0.48);
    vec3 col = mix(vec3(0.45, 0.82, 0.98), uAccentColor, vFocusGlow * 0.75);
    gl_FragColor = vec4(col, alpha);
  }
`;

const CASCADE_FLOW_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CASCADE_FLOW_FRAGMENT = `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float flow = fract(vUv.x * 3.0 - uTime * uSpeed);
    float pulse = exp(-pow((flow - 0.5) * 6.5, 2.0));
    float base = 0.22;
    vec3 col = mix(uColor, vec3(1.0), pulse * 0.75);
    float alpha = clamp(base + pulse * 0.78, 0.0, 0.95);
    gl_FragColor = vec4(col, alpha);
  }
`;

const CINEMA_POST_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 offset = (vUv - 0.5) * 0.0022;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      float grain = (rand(vUv + fract(uTime)) - 0.5) * 0.028;
      col += grain;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

function createSoftDotTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.75)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

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
  cameraPreset,
  enableParallax = true,
  allowWheelZoom = true,
  hideBottomHud = false,
  calloutFilter = "all",
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
  const controlsRef = useRef<OrbitControls | null>(null);
  const enableParallaxRef = useRef(enableParallax);
  enableParallaxRef.current = enableParallax;
  const calloutFilterRef = useRef(calloutFilter);
  calloutFilterRef.current = calloutFilter;
  const cameraPresetRef = useRef(cameraPreset);
  cameraPresetRef.current = cameraPreset;

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
    const view = ORGAN_CAMERA_VIEWS[selectedSystem] ?? FULL_BODY_VIEW;
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

  // Explicit camera preset override (used by presentation slides)
  useEffect(() => {
    if (!cameraPreset) return;
    const view =
      cameraPreset === "full"
        ? FULL_BODY_VIEW
        : (ORGAN_CAMERA_VIEWS[cameraPreset] ?? FULL_BODY_VIEW);
    flyRef.current = {
      active: true,
      targetPos: view.position.clone(),
      targetLook: view.target.clone(),
    };
  }, [cameraPreset]);

  // Sync wheel zoom permission without re-initializing WebGL
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enableZoom = allowWheelZoom;
    }
  }, [allowWheelZoom]);

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
    scene.background = new THREE.Color("#06070a");
    scene.fog = new THREE.FogExp2("#06070a", 0.19);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 30);
    camera.position.copy(FULL_BODY_VIEW.position);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(width, height);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.38,
      0.55,
      0.72
    );
    const outputPass = new OutputPass();
    const cinemaPass = new ShaderPass(CINEMA_POST_SHADER);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    composer.addPass(cinemaPass);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.copy(FULL_BODY_VIEW.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enableZoom = allowWheelZoom;
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

    // Architectural concentric floor grid rings + living particle sea under feet (skin soles sit at y = -0.913)
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
        color: 0xbae6fd,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      floorGroup.add(new THREE.Mesh(ringGeo, ringMat));
    }

    const floorParticleCount = 900;
    const floorParticlePositions = new Float32Array(floorParticleCount * 3);
    const floorParticleBase = new Float32Array(floorParticleCount * 2);
    const floorParticleColors = new Float32Array(floorParticleCount * 3);
    const cyanColor = new THREE.Color("#38bdf8");
    const iceColor = new THREE.Color("#e2e8f0");
    for (let i = 0; i < floorParticleCount; i++) {
      const angle = (i * 2.3999632) % (Math.PI * 2); // golden-angle spiral
      const norm = (i + 0.5) / floorParticleCount;
      const radius = 0.28 + Math.sqrt(norm) * 3.35;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      floorParticlePositions[i * 3] = x;
      floorParticlePositions[i * 3 + 1] = 0;
      floorParticlePositions[i * 3 + 2] = z;
      floorParticleBase[i * 2] = radius;
      floorParticleBase[i * 2 + 1] = angle;

      const mixCol = i % 3 === 0 ? iceColor : cyanColor;
      floorParticleColors[i * 3] = mixCol.r;
      floorParticleColors[i * 3 + 1] = mixCol.g;
      floorParticleColors[i * 3 + 2] = mixCol.b;
    }
    const softDotTex = createSoftDotTexture();

    const floorParticleGeo = new THREE.BufferGeometry();
    floorParticleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(floorParticlePositions, 3)
    );
    floorParticleGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(floorParticleColors, 3)
    );
    const floorParticleMat = new THREE.PointsMaterial({
      size: 0.026,
      map: softDotTex ?? undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const floorParticles = new THREE.Points(floorParticleGeo, floorParticleMat);
    floorGroup.add(floorParticles);
    scene.add(floorGroup);

    // Procedural deep-space nebula & starfield dome (strictly cool obsidian/cyan palette, never red)
    const nebulaMaterial = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERTEX_SHADER,
      fragmentShader: NEBULA_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAccentColor: { value: new THREE.Color("#0ea5e9") },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const nebulaDome = new THREE.Mesh(
      new THREE.SphereGeometry(14, 32, 24),
      nebulaMaterial
    );
    scene.add(nebulaDome);

    // Ambient floating cosmic dust particles around astronaut
    const dustCount = 220;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSeeds = Array.from({ length: dustCount }, (_, i) => ({
      x: (((i * 73) % 100) / 100 - 0.5) * 4.2,
      y: (((i * 41) % 100) / 100 - 0.5) * 2.8,
      z: (((i * 97) % 100) / 100 - 0.5) * 3.2,
      speed: 0.25 + ((i * 17) % 10) * 0.04,
    }));
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.02,
      map: softDotTex ?? undefined,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cosmicDust = new THREE.Points(dustGeo, dustMat);
    scene.add(cosmicDust);

    // 3D precision focus reticle orbiting the currently inspected organ
    const focusRingGroup = new THREE.Group();
    const focusOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const focusOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(0.115, 0.119, 48),
      focusOuterMat
    );
    const focusInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.082, 0.085, 48),
      focusOuterMat
    );
    focusInnerRing.rotation.x = Math.PI / 3;
    focusRingGroup.add(focusOuterRing, focusInnerRing);
    focusRingGroup.position.copy(ORGAN_ANCHORS[liveRef.current.selectedSystem]);
    scene.add(focusRingGroup);

    // Holographic particle shell material (populated once GLB Outer_Body_Shell loads)
    const particleShellMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_SHELL_VERTEX,
      fragmentShader: PARTICLE_SHELL_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uFocusPos: { value: ORGAN_ANCHORS[liveRef.current.selectedSystem].clone() },
        uAccentColor: { value: new THREE.Color("#2dd4bf") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

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

    const skeletonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uOpacityScale: { value: 1.0 },
        uBoneFocus: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uOpacityScale;
        uniform float uBoneFocus;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          float ndotv = clamp(abs(dot(normalize(vNormalW), normalize(vViewDir))), 0.0, 1.0);
          float rim = pow(1.0 - ndotv, 2.0);
          vec3 baseCol = mix(vec3(0.35, 0.45, 0.58), vec3(0.75, 0.86, 0.96), rim);
          vec3 focusCol = mix(vec3(0.30, 0.55, 0.72), vec3(0.56, 0.88, 1.0), rim);
          vec3 col = mix(baseCol, focusCol, uBoneFocus * 0.65);
          float alpha = mix(0.025, 0.42 + uBoneFocus * 0.14, rim) * uOpacityScale;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
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
      size: 0.022,
      map: softDotTex ?? undefined,
      transparent: true,
      opacity: 0.8,
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
      size: 0.024,
      map: softDotTex ?? undefined,
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
      size: 0.021,
      map: softDotTex ?? undefined,
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
      tubeMat: THREE.ShaderMaterial;
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
        const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.0045, 8, false);
        const colorHex = cascade.severity === "red" ? 0xf87171 : 0xfbbf24;
        const tubeMat = new THREE.ShaderMaterial({
          vertexShader: CASCADE_FLOW_VERTEX,
          fragmentShader: CASCADE_FLOW_FRAGMENT,
          uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: cascade.severity === "red" ? 1.15 : 0.75 },
            uColor: { value: new THREE.Color(colorHex) },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        cascadeGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

        const pulseGeo = new THREE.SphereGeometry(0.011, 12, 12);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        cascadeGroup.add(pulseMesh);

        activeCascadeAnimators.push({
          curve,
          pulseMesh,
          tubeMat,
          speedOffset: idx * 0.27,
        });
      });
    };

    rebuildCascadesRef.current = rebuildCascades;
    rebuildCascades();

    // Load Blender-exported multi-layer clinical GLB
    let disposed = false;
    let skeletalFrameMesh: THREE.Mesh | null = null;
    let armBonesLoaded = false;

    const stripProceduralArmTubes = (geometry: THREE.BufferGeometry) => {
      const pos = geometry.getAttribute("position");
      if (!pos) return;
      const idx = geometry.getIndex();
      const isReplacedTri = (a: number, b: number, c: number) => {
        const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
        const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
        const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
        const isArm = Math.abs(cx) > 0.205 && cy < 0.59;
        const isClavicle =
          Math.abs(cx) > 0.020 && cy > 0.612 && cy < 0.668 && cz > 0.0;
        return isArm || isClavicle;
      };
      if (idx) {
        const kept: number[] = [];
        for (let i = 0; i < idx.count; i += 3) {
          const a = idx.getX(i);
          const b = idx.getX(i + 1);
          const c = idx.getX(i + 2);
          if (!isReplacedTri(a, b, c)) {
            kept.push(a, b, c);
          }
        }
        geometry.setIndex(kept);
      }
    };

    const alignBoneSegmentToVector = (
      meshes: THREE.Mesh[],
      targetStart: THREE.Vector3,
      targetEnd: THREE.Vector3,
      proximalMode: "maxY" | "minX" | "maxX" = "maxY"
    ) => {
      let minVal = Infinity;
      let maxVal = -Infinity;
      const getCoord = (vec: THREE.Vector3) =>
        proximalMode === "maxY" ? vec.y : vec.x;

      for (const m of meshes) {
        m.updateMatrixWorld(true);
        const pos = m.geometry.getAttribute("position");
        if (!pos) continue;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          const c = getCoord(v);
          if (c < minVal) minVal = c;
          if (c > maxVal) maxVal = c;
        }
      }
      const span = Math.max(0.001, maxVal - minVal);
      const highThresh = maxVal - span * 0.12;
      const lowThresh = minVal + span * 0.12;
      const prox = new THREE.Vector3();
      const dist = new THREE.Vector3();
      let proxCount = 0;
      let distCount = 0;
      const v = new THREE.Vector3();

      for (const m of meshes) {
        const pos = m.geometry.getAttribute("position");
        if (!pos) continue;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          const c = getCoord(v);
          const isProx =
            proximalMode === "minX" ? c <= lowThresh : c >= highThresh;
          const isDist =
            proximalMode === "minX" ? c >= highThresh : c <= lowThresh;
          if (isProx) {
            prox.add(v);
            proxCount++;
          } else if (isDist) {
            dist.add(v);
            distCount++;
          }
        }
      }
      if (proxCount === 0 || distCount === 0) return null;
      prox.divideScalar(proxCount);
      dist.divideScalar(distCount);

      const boneVec = dist.clone().sub(prox);
      const targetVec = targetEnd.clone().sub(targetStart);
      if (boneVec.lengthSq() < 1e-6) return null;

      const scaleFactor = targetVec.length() / boneVec.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        boneVec.clone().normalize(),
        targetVec.clone().normalize()
      );

      const group = new THREE.Group();
      for (const m of meshes) {
        m.geometry.applyMatrix4(m.matrixWorld);
        m.position.set(0, 0, 0);
        m.rotation.set(0, 0, 0);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        m.material = skeletonMaterial;
        m.renderOrder = 2;
        group.add(m);
      }

      group.scale.setScalar(scaleFactor);
      group.quaternion.copy(quat);
      const transformedProx = prox
        .clone()
        .multiplyScalar(scaleFactor)
        .applyQuaternion(quat);
      group.position.copy(targetStart).sub(transformedProx);
      return group;
    };

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

            // Sample Outer_Body_Shell vertices into holographic point-cloud layer
            const posAttr = obj.geometry.getAttribute("position");
            const normAttr = obj.geometry.getAttribute("normal");
            if (posAttr && normAttr) {
              const totalVerts = posAttr.count;
              const maxPoints = 3200;
              const stride = Math.max(1, Math.floor(totalVerts / maxPoints));
              const sampledPositions: number[] = [];
              const sampledNormals: number[] = [];
              for (let idx = 0; idx < totalVerts; idx += stride) {
                sampledPositions.push(
                  posAttr.getX(idx),
                  posAttr.getY(idx),
                  posAttr.getZ(idx)
                );
                sampledNormals.push(
                  normAttr.getX(idx),
                  normAttr.getY(idx),
                  normAttr.getZ(idx)
                );
              }
              const pGeo = new THREE.BufferGeometry();
              pGeo.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(sampledPositions, 3)
              );
              pGeo.setAttribute(
                "normal",
                new THREE.Float32BufferAttribute(sampledNormals, 3)
              );
              const particleShell = new THREE.Points(pGeo, particleShellMaterial);
              particleShell.renderOrder = 11;
              scene.add(particleShell);
            }
            continue;
          }
          if (obj.name === "Skeletal_Frame") {
            obj.material = skeletonMaterial;
            obj.renderOrder = 2;
            skeletalFrameMesh = obj;
            if (armBonesLoaded) {
              stripProceduralArmTubes(obj.geometry);
            }
            scene.add(obj);
            continue;
          }

          const parsed = parseOrganNodeName(obj.name);
          if (!parsed) continue;

          const sysId = parsed.systemId;
          if (parsed.tissueTag === "Bone") {
            // Unify pelvis, femurs, and knees with Skeletal_Frame X-ray Fresnel shader
            obj.material = skeletonMaterial;
            obj.userData = { systemId: sysId, parsed };
            obj.renderOrder = 2;
            scene.add(obj);
            organPickTargets.push(obj);
            continue;
          }

          const isShell = parsed.layer === "Shell";
          const baseHex = resolveStructureColorHex(parsed);
          const baseColor = new THREE.Color(baseHex);
          const baseOpacity = isShell
            ? 0.72
            : parsed.tissueTag === "Artery" || parsed.tissueTag === "Vein"
              ? 0.88
              : 0.95;

          const mat = new THREE.MeshPhysicalMaterial({
            color: baseColor.clone(),
            emissive: baseColor.clone(),
            emissiveIntensity: isShell ? 0.14 : 0.26,
            roughness: isShell ? 0.42 : 0.34,
            metalness: 0.06,
            clearcoat: 0.25,
            clearcoatRoughness: 0.3,
            transparent: true,
            opacity: baseOpacity,
            depthWrite: false,
            side: isShell ? THREE.FrontSide : THREE.DoubleSide,
          });
          mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <dithering_fragment>",
              `
                float holoRim = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 1.85);
                gl_FragColor.rgb += totalEmissiveRadiance * holoRim * 0.9;
                gl_FragColor.a = clamp(gl_FragColor.a * (0.34 + holoRim * 0.95), 0.04, 0.90);
                #include <dithering_fragment>
              `
            );
          };

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

    // Replace procedural arm tubes with real anatomical humerus, radius & ulna bones aligned to body pose
    loader.load(
      "/models/skeleton.glb",
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;
        root.updateMatrixWorld(true);

        const byName = new Map<string, THREE.Mesh>();
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            byName.set(obj.name, obj);
          }
        });

        const armSpecs: Array<{
          names: string[];
          start: THREE.Vector3;
          end: THREE.Vector3;
          proximalMode?: "maxY" | "minX" | "maxX";
        }> = [
          // Bilateral clavicles (tucked strictly inside Outer_Body_Shell chest/shoulder bounds)
          {
            names: ["left-clavicle"],
            start: new THREE.Vector3(0.022, 0.632, 0.056),
            end: new THREE.Vector3(0.178, 0.618, -0.014),
            proximalMode: "minX",
          },
          {
            names: ["right-clavicle"],
            start: new THREE.Vector3(-0.022, 0.632, 0.056),
            end: new THREE.Vector3(-0.178, 0.618, -0.014),
            proximalMode: "maxX",
          },
          // Left arm (+X in BioTwin world space, centered in Outer_Body_Shell cross-sections)
          {
            names: ["left-humerus"],
            start: new THREE.Vector3(0.198, 0.574, -0.022),
            end: new THREE.Vector3(0.288, 0.265, -0.022),
          },
          {
            names: ["left-radius", "left-ulna"],
            start: new THREE.Vector3(0.288, 0.265, -0.022),
            end: new THREE.Vector3(0.422, 0.048, 0.004),
          },
          // Right arm (-X in BioTwin world space, centered in Outer_Body_Shell cross-sections)
          {
            names: ["right-humerus"],
            start: new THREE.Vector3(-0.198, 0.574, -0.022),
            end: new THREE.Vector3(-0.288, 0.265, -0.022),
          },
          {
            names: ["right-radius", "right-ulna"],
            start: new THREE.Vector3(-0.288, 0.265, -0.022),
            end: new THREE.Vector3(-0.422, 0.048, 0.004),
          },
        ];

        let addedCount = 0;
        for (const spec of armSpecs) {
          const meshes = spec.names
            .map((n) => byName.get(n))
            .filter((m): m is THREE.Mesh => Boolean(m));
          if (meshes.length === 0) continue;
          const seg = alignBoneSegmentToVector(
            meshes,
            spec.start,
            spec.end,
            spec.proximalMode ?? "maxY"
          );
          if (seg) {
            scene.add(seg);
            addedCount++;
          }
        }

        if (addedCount > 0) {
          armBonesLoaded = true;
          if (skeletalFrameMesh) {
            stripProceduralArmTubes(skeletalFrameMesh.geometry);
          }
        }
      },
      undefined,
      () => {
        // Keep procedural arm tubes silently if skeleton.glb is unavailable
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

    const parallaxTarget = new THREE.Vector2(0, 0);
    const parallaxCurrent = new THREE.Vector2(0, 0);
    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (!enableParallaxRef.current) {
        parallaxTarget.set(0, 0);
        return;
      }
      const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const ny = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
      parallaxTarget.set(
        Math.max(-1, Math.min(1, nx)),
        Math.max(-1, Math.min(1, ny))
      );
    };
    window.addEventListener("pointermove", handleWindowPointerMove, { passive: true });

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
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
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
      skeletonMaterial.uniforms.uOpacityScale.value =
        effectiveMode === "xray"
          ? 1.25
          : effectiveMode === "vascular"
            ? 0.45
            : 0.95;
      const boneFocused = snapshot.selectedSystem === "musculoskeletal_renal" ? 1.0 : 0.0;
      skeletonMaterial.uniforms.uBoneFocus.value +=
        (boneFocused - skeletonMaterial.uniforms.uBoneFocus.value) * 0.12;
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
      nebulaMaterial.uniforms.uTime.value = t;
      particleShellMaterial.uniforms.uTime.value = t;
      particleShellMaterial.uniforms.uFocusPos.value.copy(
        shellMaterial.uniforms.uFocusPos.value
      );
      particleShellMaterial.uniforms.uAccentColor.value.lerp(targetColor, 0.12);
      cinemaPass.uniforms.uTime.value = t;

      // Update precision 3D focus reticle around selected organ
      focusRingGroup.position.lerp(ORGAN_ANCHORS[snapshot.selectedSystem], 0.14);
      focusOuterRing.quaternion.copy(camera.quaternion);
      focusInnerRing.rotation.z = t * 0.65;
      focusInnerRing.rotation.y = t * 0.42;
      focusOuterMat.color.lerp(targetColor, 0.14);

      // Update ambient cosmic dust drift
      const dAttr = dustGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        const s = dustSeeds[i];
        dAttr.setXYZ(
          i,
          s.x + Math.sin(t * s.speed + i) * 0.06,
          s.y + Math.cos(t * s.speed * 0.8 + i) * 0.05,
          s.z
        );
      }
      dAttr.needsUpdate = true;

      // Gentle breathing wave on the floor particle sea
      const floorPosAttr = floorParticleGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < floorParticleCount; i++) {
        const r = floorParticleBase[i * 2];
        const a = floorParticleBase[i * 2 + 1];
        const wave = Math.sin(r * 2.8 - t * 1.15 + a * 2.0) * 0.014;
        floorPosAttr.setY(i, wave);
      }
      floorPosAttr.needsUpdate = true;

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
            // Keep each organ's distinct anatomical color; blend only a subtle status tint
            const alertBlend = isShell
              ? 0.18
              : preserveAnatomicalHue
                ? 0.08
                : 0.14;
            targetColor.copy(entry.baseColor).lerp(statusColorObj, alertBlend);
          }
          entry.material.color.lerp(targetColor, 0.14);
          entry.material.emissive.lerp(targetColor, 0.14);

          const isOverview = cameraPresetRef.current === "full";
          let targetOpacity = isSelected
            ? isShell
              ? 0.56
              : 0.78
            : isOverview
              ? isShell
                ? 0.36
                : entry.meta.tissueTag === "Artery" || entry.meta.tissueTag === "Vein"
                  ? 0.54
                  : 0.52
              : isShell
                ? 0.15
                : entry.meta.tissueTag === "Artery" || entry.meta.tissueTag === "Vein"
                  ? 0.28
                  : 0.22;
          if (effectiveMode === "xray") {
            targetOpacity = isShell ? 0.18 : isSelected ? 0.80 : isOverview ? 0.52 : 0.26;
          } else if (effectiveMode === "vascular") {
            targetOpacity = isVascularTissue ? (isShell ? 0.32 : 0.80) : 0.06;
          }
          entry.material.opacity += (targetOpacity - entry.material.opacity) * 0.16;
          entry.material.depthWrite = false;
          entry.mesh.renderOrder = isVascularTissue && effectiveMode === "vascular" ? 8 : isShell ? 6 : 4;

          const dimNonVascular = effectiveMode === "vascular" && !isVascularTissue;
          const baseEmissive = dimNonVascular
            ? 0.04
            : isSelected
              ? isShell
                ? 0.42
                : 0.85
              : assessment.status === "green"
                ? isShell
                  ? 0.12
                  : 0.22
                : 0.42;
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

      // Animate 3D Domino Cascade Pulse Spheres & Flow Shader along spline tubes
      const hrSpeedMult = Math.max(0.7, (snapshot.vitals?.heartRateBpm ?? 68) / 68);
      for (const anim of activeCascadeAnimators) {
        anim.tubeMat.uniforms.uTime.value = t;
        anim.tubeMat.uniforms.uSpeed.value = 0.85 * hrSpeedMult;
        const u = (t * 0.55 * hrSpeedMult + anim.speedOffset) % 1.0;
        const pos = anim.curve.getPointAt(u);
        anim.pulseMesh.position.copy(pos);
      }

      // Apply damped cursor parallax offset temporarily for render + 2D pill projection
      if (enableParallaxRef.current) {
        parallaxCurrent.lerp(parallaxTarget, 1 - Math.exp(-4.5 * dt));
      } else {
        parallaxCurrent.lerp(new THREE.Vector2(0, 0), 1 - Math.exp(-6.0 * dt));
      }
      camRight
        .setFromMatrixColumn(camera.matrixWorld, 0)
        .multiplyScalar(parallaxCurrent.x * 0.065);
      camUp
        .setFromMatrixColumn(camera.matrixWorld, 1)
        .multiplyScalar(parallaxCurrent.y * 0.04);
      camera.position.add(camRight).add(camUp);
      camera.updateMatrixWorld();

      composer.render();

      // Project 3D organ anchors to 2D callout pill positions via refs (zero React re-renders)
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      for (const sysId of SYSTEM_ORDER) {
        const pillEl = pillRefs.current[sysId];
        if (!pillEl) continue;
        const filterMode = calloutFilterRef.current;
        if (
          filterMode === "none" ||
          (filterMode === "selected" && sysId !== snapshot.selectedSystem)
        ) {
          pillEl.style.opacity = "0";
          pillEl.style.pointerEvents = "none";
          continue;
        }
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

      // Restore camera position so OrbitControls never drifts
      camera.position.sub(camRight).sub(camUp);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", cancelFlyOnUserDrag);
      controlsRef.current = null;
      controls.dispose();
      window.removeEventListener("pointermove", handleWindowPointerMove);
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
      composer.dispose();
      bloomPass.dispose();
      softDotTex?.dispose();
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
          className="pointer-events-none absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111113]/90 px-2.5 py-1 font-mono text-[10px] text-[#d4d4d8] shadow-lg backdrop-blur-md"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"
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
          <span className="text-[#52525b]">·</span>
          <span className="truncate text-[#a1a1aa]">
            {hardwareSourceLabel ?? "CSA ASTROSKIN / ISS ETHOS"}
          </span>
          <span className="text-[#52525b]">·</span>
          <span className="font-semibold text-white tabular-nums">
            {vitals?.heartRateBpm ?? 68} BPM
          </span>
        </div>
      )}

      {/* Surgical Sub-Structure Raycast HUD */}
      {loadState === "ready" && !hideBottomHud && (
        <div
          data-testid="surgical-hud-readout"
          className="pointer-events-none absolute right-3 bottom-3 left-3 z-20 flex max-w-[340px] items-stretch gap-2.5 rounded-xl border border-white/[0.08] bg-[#111113]/90 px-3 py-2 shadow-xl backdrop-blur-md"
        >
          <span
            className="w-[2px] shrink-0 rounded-full"
            style={{ backgroundColor: hudAccentHex }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#71717a]">
              <span className="truncate">
                {hoveredInfo ? "RAYCAST TARGET" : "ACTIVE SUB-STRUCTURE"}
              </span>
              <span className="shrink-0 whitespace-nowrap rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] text-[#d4d4d8]">
                {activeHudInfo.layer} · {activeHudInfo.tissueTag}
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-medium text-white">
              {activeHudInfo.structureLabel}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-[#71717a]">
              {BODY_SYSTEM_METADATA[activeHudInfo.systemId].shortLabel}
            </p>
          </div>
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
              className={`absolute top-0 left-0 z-10 inline-flex h-[22px] items-center gap-1.5 rounded-md border px-2 font-mono text-[9.5px] font-medium backdrop-blur-md transition-colors ${
                isSelected
                  ? "border-white bg-white text-[#0a0a0a] shadow-lg"
                  : "border-white/[0.12] bg-[#111113]/85 text-[#e4e4e7] hover:border-white/30 hover:text-white"
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              <span>{shortTitle}</span>
              <span className={isSelected ? "text-[#0a0a0a]/75" : "text-[#71717a]"}>
                {assessment.score}
              </span>
            </button>
          );
        })}
    </div>
  );
}

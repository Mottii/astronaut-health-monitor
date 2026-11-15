import * as THREE from "three";
import { STORY_CHAPTER_COUNT, wrapStoryProgress } from "@/lib/briefingPath";
import { PRESENTATION_ACCENTS } from "@/data/presentationTheme";

// One consistent particle layer across every chapter, including radiation.
const PROFILES = [
  { flow: [0.012, -0.024, 0.12, 0.00], opacity: 0.56 }, // stardust
  { flow: [0.020, 0.028, 0.09, 0.03], opacity: 0.52 }, // microgravity
  { flow: [0.005, 0.090, 0.055, 0.00], opacity: 0.58 }, // fluid shift
  { flow: [0.020, -0.028, 0.16, 0.10], opacity: 0.55 }, // circulation
  { flow: [0.027, -0.070, 0.085, 0.02], opacity: 0.58 }, // mineral drift
  { flow: [0.018, -0.080, 0.065, 0.02], opacity: 0.58 }, // radiation drift
  { flow: [0.016, -0.020, 0.11, 0.10], opacity: 0.54 }, // circadian waves
] as const;

const VERTEX = `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uBlend;
  uniform vec4 uFlowA;
  uniform vec4 uFlowB;
  uniform float uAspect;
  uniform float uPixelRatio;
  varying float vLight;
  varying vec2 vScreen;
  vec3 drift(vec4 flow) {
    float angle = aSeed.w * 6.2831853 + uTime * 0.12;
    vec2 p = fract(aSeed.xy + flow.xy * uTime) * 2.0 - 1.0;
    p.x += sin(angle + p.y * 2.0) * flow.z;
    p.y += cos(angle * 0.7 + p.x * 3.0) * flow.z * 0.55;
    p *= 1.0 + sin(uTime * 0.75 + aSeed.w * 4.0) * flow.w;
    return vec3(p.x * uAspect, p.y, (aSeed.z - 0.5) * 0.65);
  }
  void main() {
    vec3 pos = mix(drift(uFlowA), drift(uFlowB), uBlend);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
    gl_Position = clip;
    vScreen = clip.xy / clip.w * 0.5 + 0.5;
    float edge = 1.0 - smoothstep(0.75,1.05,max(abs(pos.x / uAspect),abs(pos.y)));
    vLight = edge * (0.4 + aSeed.z * 0.5) * (0.88 + 0.12 * sin(uTime * 0.55 + aSeed.w * 30.0));
    gl_PointSize = (2.0 + aSeed.z * 2.8) * uPixelRatio;
  }
`;

const FRAGMENT = `
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uPortrait;
  varying float vLight;
  varying vec2 vScreen;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    float halo = exp(-radius * radius * 3.0) * (1.0 - smoothstep(0.65,1.0,radius));
    // Leave the editorial copy clear on desktop and the lower text area clear on phones.
    float clearance = mix(smoothstep(0.34,0.55,vScreen.x),smoothstep(0.36,0.61,vScreen.y),uPortrait);
    gl_FragColor = vec4(uColour,halo * vLight * uOpacity * clearance);
  }
`;

export function sampleAtmosphere(progress: number) {
  const wrapped = wrapStoryProgress(progress);
  const left = Math.floor(wrapped);
  const fraction = wrapped - left;
  return {
    left,
    right: (left + 1) % STORY_CHAPTER_COUNT,
    blend: fraction * fraction * (3 - 2 * fraction),
  };
}

export function createChapterAtmosphere(count: number, pixelRatio: number) {
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // Reproducible, well-spread phases keep remounts and loop joins quiet.
    seeds.set([
      (i * 0.618033989 + 0.17) % 1,
      (i * 0.754877666 + 0.31) % 1,
      (i * 0.569840291 + 0.53) % 1,
      (i * 0.438579021 + 0.73) % 1,
    ], i * 4);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  const colours = PRESENTATION_ACCENTS.map((accent) => new THREE.Color(accent));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 }, uBlend: { value: 0 }, uFlowA: { value: new THREE.Vector4() }, uFlowB: { value: new THREE.Vector4() },
      uColour: { value: new THREE.Color() }, uOpacity: { value: 0 }, uAspect: { value: 1 },
      uPixelRatio: { value: pixelRatio }, uPortrait: { value: 0 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 15;

  return {
    points,
    update(progress: number, time: number, camera: THREE.PerspectiveCamera, target: THREE.Vector3, reducedMotion: boolean) {
      points.visible = !reducedMotion;
      if (!points.visible) return;
      const state = sampleAtmosphere(progress);
      const a = PROFILES[state.left], b = PROFILES[state.right];
      material.uniforms.uTime.value = time;
      material.uniforms.uBlend.value = state.blend;
      material.uniforms.uFlowA.value.fromArray(a.flow);
      material.uniforms.uFlowB.value.fromArray(b.flow);
      material.uniforms.uColour.value.copy(colours[state.left]).lerp(colours[state.right], state.blend);
      material.uniforms.uOpacity.value = THREE.MathUtils.lerp(a.opacity, b.opacity, state.blend);
      material.uniforms.uAspect.value = camera.aspect;
      material.uniforms.uPortrait.value = camera.aspect < 1.1 ? 1 : 0;
      points.position.copy(target);
      points.quaternion.copy(camera.quaternion);
      const halfHeight = camera.position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      points.scale.setScalar(halfHeight * 1.08);
    },
  };
}

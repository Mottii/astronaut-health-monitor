import * as THREE from "three";
import type { BodySystemId } from "@/types/health";

// One continuous path through the existing seven chapters. No per-chapter reset.
const positions = [
  [0.34, 0.10, 2.98], [0.30, 0.86, 1.12], [-0.30, 0.53, 1.40],
  [0.46, 0.34, 1.65], [-0.34, 0.59, 1.7], [0.30, 0.39, 1.4], [0.34, 0.10, 2.98],
];
const targets = [
  [0, 0, 0], [0, 0.77, 0.01], [0.01, 0.43, 0.02],
  [0, 0.22, 0], [0, 0.44, 0], [-0.02, 0.31, 0.01], [0, 0, 0],
];
const positionPath = new THREE.CatmullRomCurve3(positions.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "catmullrom", 0.32);
const targetPath = new THREE.CatmullRomCurve3(targets.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "catmullrom", 0.32);

export const STORY_SYSTEMS: Array<BodySystemId | null> = [
  null, "neuro_ocular", "cardiovascular", "musculoskeletal_renal",
  "immune_hematology", "metabolic_endocrine", null,
];

export function sampleBriefingPose(progress: number, position: THREE.Vector3, target: THREE.Vector3): void {
  const t = Math.max(0, Math.min(6, progress)) / 6;
  positionPath.getPoint(t, position);
  targetPath.getPoint(t, target);
}

export function storyFocus(progress: number): { overview: number; systems: Record<BodySystemId, number> } {
  const p = Math.max(0, Math.min(6, progress));
  const left = Math.floor(p);
  const right = Math.min(6, left + 1);
  const fraction = p - left;
  const blend = fraction * fraction * (3 - 2 * fraction);
  const systems: Record<BodySystemId, number> = {
    neuro_ocular: 0, cardiovascular: 0, musculoskeletal_renal: 0,
    immune_hematology: 0, metabolic_endocrine: 0, behavioral_circadian: 0,
  };
  let overview = 0;
  for (const [index, weight] of [[left, 1 - blend], [right, blend]]) {
    const system = STORY_SYSTEMS[index];
    if (system) systems[system] += weight;
    else overview += weight;
  }
  return { overview, systems };
}

export function followScroll(current: number, target: number, deltaSeconds: number): number {
  return current + (target - current) * (1 - Math.exp(-7.5 * Math.max(0, Math.min(deltaSeconds, 0.05))));
}

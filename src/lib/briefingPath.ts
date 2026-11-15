import * as THREE from "three";
import type { BodySystemId } from "@/types/health";

// A closed path: the metabolic chapter leads directly back into the title.
const positions = [
  [0.33, 0.10, 2.86], [0.24, 0.48, 1.92], [0.30, 0.86, 1.12], [-0.30, 0.53, 1.40],
  [0.46, 0.34, 1.65], [-0.34, 0.59, 1.7], [0.30, 0.39, 1.4],
];
const targets = [
  [0, 0, 0], [0, 0.42, 0], [0, 0.77, 0.01], [0.01, 0.43, 0.02],
  [0, 0.22, 0], [0, 0.44, 0], [-0.02, 0.31, 0.01],
];
const positionPath = new THREE.CatmullRomCurve3(positions.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true, "catmullrom", 0.32);
const targetPath = new THREE.CatmullRomCurve3(targets.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true, "catmullrom", 0.32);

export const STORY_SYSTEMS: Array<BodySystemId | null> = [
  null, null, "neuro_ocular", "cardiovascular", "musculoskeletal_renal",
  "immune_hematology", "metabolic_endocrine",
];

export const STORY_CHAPTER_COUNT = STORY_SYSTEMS.length;

export function wrapStoryProgress(progress: number): number {
  const wrapped = progress % STORY_CHAPTER_COUNT;
  return wrapped < 0 ? wrapped + STORY_CHAPTER_COUNT : wrapped === 0 ? 0 : wrapped;
}

/** Keep the native scroller in the middle copy, without waiting for the camera. */
export function rebaseStoryProgress(progress: number): { progress: number; shift: number } {
  const shift = progress >= STORY_CHAPTER_COUNT
    ? Math.floor(progress / STORY_CHAPTER_COUNT) * STORY_CHAPTER_COUNT
    : progress <= -1
      ? (Math.ceil((progress + 1) / STORY_CHAPTER_COUNT) - 1) * STORY_CHAPTER_COUNT
      : 0;
  return { progress: progress - shift, shift };
}

/** Keep animation time continuous when the DOM jumps between identical scroll copies. */
export function unwrapStoryProgress(previous: number, physical: number): number {
  return physical + Math.round((previous - physical) / STORY_CHAPTER_COUNT) * STORY_CHAPTER_COUNT;
}

/** The title has editorial copy in place of anatomy; both joins use the same fade. */
export function storyTitlePresence(progress: number): number {
  const wrapped = wrapStoryProgress(progress);
  const distance = Math.min(wrapped, STORY_CHAPTER_COUNT - wrapped);
  const t = Math.min(1, distance / 0.85);
  return 1 - t * t * (3 - 2 * t);
}

export function storyScrollTarget(current: number, requested: number): number {
  if (current === STORY_CHAPTER_COUNT - 1 && requested === 0) return STORY_CHAPTER_COUNT;
  if (current === 0 && requested === STORY_CHAPTER_COUNT - 1) return -1;
  return Math.max(-1, Math.min(STORY_CHAPTER_COUNT, requested));
}

export function sampleBriefingPose(progress: number, position: THREE.Vector3, target: THREE.Vector3): void {
  const t = wrapStoryProgress(progress) / STORY_CHAPTER_COUNT;
  positionPath.getPoint(t, position);
  targetPath.getPoint(t, target);
}

export function storyFocus(progress: number): { overview: number; systems: Record<BodySystemId, number> } {
  const p = wrapStoryProgress(progress);
  const left = Math.floor(p);
  const right = (left + 1) % STORY_CHAPTER_COUNT;
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

/** Gentle idle yaw plus a stronger, continuous turn as each chapter passes. */
export function sampleBodyTurn(progress: number, time: number, reducedMotion = false): number {
  if (reducedMotion) return 0;
  const phase = wrapStoryProgress(progress);
  return Math.sin(time*0.24)*0.12 + Math.sin(time*0.11)*0.035
    + Math.sin(phase*Math.PI*2/STORY_CHAPTER_COUNT)*0.12
    + Math.sin(phase*Math.PI*2)*0.16;
}

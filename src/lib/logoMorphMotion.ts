import { STORY_CHAPTER_COUNT, wrapStoryProgress } from "@/lib/briefingPath";

function smooth(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Assemble the apex first, then sweep down the legs; particle arrival precedes the shell. */
export function logoAssemblyAtHeight(height: number, intro: number): number {
  const topToBottom = Math.max(0,Math.min(1,(1-height)*0.5));
  return smooth(topToBottom*0.72,topToBottom*0.72+0.28,intro);
}

/** One reversible timeline for the intro, the actual mesh, and the particle handoff. */
export function sampleLogoMorph(progress: number, elapsed: number, reducedMotion = false) {
  const wrapped = wrapStoryProgress(progress);
  const distance = Math.min(wrapped, STORY_CHAPTER_COUNT - wrapped);
  const intro = reducedMotion ? 1 : smooth(0.15, 3.1, elapsed);
  return {
    intro,
    morph: smooth(0.12, 0.94, distance),
    shell: intro * (1 - smooth(0.12, 0.57, distance)),
    particles: intro * (1 - smooth(0.76, 1.02, distance)),
    mist: 1 - smooth(0.60, 1.08, distance),
    body: smooth(0.48, 0.98, distance),
    drop: (1 - intro) * 0.42 - smooth(0, 0.65, distance) * 0.38,
  };
}

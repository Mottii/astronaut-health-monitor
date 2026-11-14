/** Shared timing for the camera, shader scan and DOM choreography. */
export const BRIEFING_TRANSITION_MS = 1800;
export const BRIEFING_EXIT_MS = 180;

export function easeInOutCubic(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A continuous orbiting detour that rejoins both exact camera endpoints. */
export function cameraArc(progress: number, distance: number): number {
  return Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) *
    Math.min(0.42, distance * 0.22);
}

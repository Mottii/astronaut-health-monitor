interface PortraitBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Start revealing a portrait before the pointer reaches its edge. */
export function samplePortraitProximity(clientX: number, clientY: number, bounds: PortraitBounds, radius = 270) {
  const x = clientX - bounds.left;
  const y = clientY - bounds.top;
  const dx = Math.max(0, -x, x - bounds.width);
  const dy = Math.max(0, -y, y - bounds.height);
  const t = Math.max(0, 1 - Math.hypot(dx, dy) / Math.max(1, radius));
  return { x, y, strength: t * t * (3 - 2 * t) };
}

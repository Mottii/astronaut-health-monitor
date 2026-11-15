export const PANEL_DIVIDER_WIDTH = 10;

export function panelResizeBounds(width: number, minPrimary: number, minSecondary: number, maxPrimary = Infinity) {
  const available = Math.max(0, width - PANEL_DIVIDER_WIDTH);
  // Keep both panes usable even if the surrounding layout becomes narrower than their preferred minima.
  const scale = Math.min(1, available / (minPrimary + minSecondary));
  const min = minPrimary * scale;
  const max = Math.max(min, Math.min(maxPrimary, available - minSecondary * scale));
  return { min, max };
}

export function clampPanelSize(size: number, width: number, minPrimary: number, minSecondary: number, maxPrimary?: number) {
  const { min, max } = panelResizeBounds(width, minPrimary, minSecondary, maxPrimary);
  return Math.max(min, Math.min(max, size));
}

import { describe, expect, it } from "vitest";
import { clampPanelSize, panelResizeBounds, PANEL_DIVIDER_WIDTH } from "@/lib/panelResize";

describe("console panel resizing", () => {
  it("keeps the model and CMO usable when dragging beyond either edge", () => {
    expect(clampPanelSize(-1000, 1200, 560, 340)).toBe(560);
    expect(clampPanelSize(4000, 1200, 560, 340)).toBe(850);
    expect(clampPanelSize(720, 1200, 560, 340)).toBe(720);
  });

  it("reclamps the nested sidebar when its parent is narrowed", () => {
    const sidebar = clampPanelSize(360, 900, 192, 320, 360);
    expect(sidebar).toBe(360);
    const narrowed = clampPanelSize(sidebar, 560, 192, 320, 360);
    expect(narrowed).toBe(230);
    expect(560 - PANEL_DIVIDER_WIDTH - narrowed).toBe(320);
    expect(clampPanelSize(2000, 1200, 192, 320, 360)).toBe(360);
  });

  it("avoids negative tracks or overflow when the viewport cannot fit the preferred minima", () => {
    for (const width of [0, 5, 240, 500, 900, 1024, 1920]) {
      const { min, max } = panelResizeBounds(width, 560, 340);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeGreaterThanOrEqual(min);
      for (const requested of [-1000, 0, 500, 4000]) {
        const primary = clampPanelSize(requested, width, 560, 340);
        const available = Math.max(0, width - PANEL_DIVIDER_WIDTH);
        expect(primary).toBeGreaterThanOrEqual(0);
        expect(primary).toBeLessThanOrEqual(available);
        expect(available - primary).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

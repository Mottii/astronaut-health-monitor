import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startConsoleTransition } from "@/lib/consoleTransition";

describe("CMO console transition", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens the console even if audio throws or CSS animation never finishes", () => {
    const navigate = vi.fn();
    startConsoleTransition(navigate, () => { throw new Error("AudioContext blocked"); }, 720);
    vi.advanceTimersByTime(720);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it("navigates once when animation completion and the timer both fire", () => {
    const navigate = vi.fn();
    const transition = startConsoleTransition(navigate, () => {}, 720);
    transition.finish();
    transition.finish();
    vi.advanceTimersByTime(1000);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  it("cancels navigation when the briefing unmounts", () => {
    const navigate = vi.fn();
    const transition = startConsoleTransition(navigate, () => {}, 720);
    transition.cancel();
    transition.finish();
    vi.advanceTimersByTime(1000);
    expect(navigate).not.toHaveBeenCalled();
  });
});

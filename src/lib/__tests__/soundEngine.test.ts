import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AresSoundEngine } from "@/lib/soundEngine";

class MockAudio {
  static instances: MockAudio[] = [];
  src = "";
  volume = 0;
  loop = false;
  preload = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor() { MockAudio.instances.push(this); }
}

describe("background music playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockAudio.instances = [];
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("window", { setInterval, clearInterval, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tracks: ["/music/i-saac-charon.mp3", "/music/max-brhon-dark-soul.m4a"] }) }));
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("starts from the music folder and switches to a different song after ended", async () => {
    const engine = new AresSoundEngine();
    expect(engine.initAutoplay()).toBe(true);
    const audio = MockAudio.instances[0];
    const first = audio.src;
    expect(first.startsWith("/music/")).toBe(true);
    expect(audio.loop).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(audio.volume).toBeCloseTo(0.34);
    audio.onended?.();
    expect(audio.src).not.toBe(first);
    expect(audio.play).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    engine.setEnabled(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(audio.pause).toHaveBeenCalledTimes(1);
    const calls = audio.play.mock.calls.length;
    audio.onended?.();
    expect(audio.play).toHaveBeenCalledTimes(calls);
    expect(engine.initAutoplay()).toBe(false);
  });

  it("waits for a gesture when autoplay is blocked without skipping the track", async () => {
    const engine = new AresSoundEngine();
    engine.initAutoplay();
    const audio = MockAudio.instances[0];
    await vi.advanceTimersByTimeAsync(0);
    audio.play.mockRejectedValueOnce({ name: "NotAllowedError" });
    engine.setEnabled(true);
    const track = audio.src;
    await vi.advanceTimersByTimeAsync(0);
    const listener = vi.mocked(window.addEventListener).mock.calls.find(([type]) => type === "pointerdown")?.[1];
    expect(listener).toBeTypeOf("function");
    (listener as () => void)();
    await vi.advanceTimersByTimeAsync(1000);
    expect(audio.src).toBe(track);
    expect(audio.volume).toBeCloseTo(0.34);
  });

  it("skips broken files and stops retrying when all files fail", async () => {
    const engine = new AresSoundEngine();
    engine.initAutoplay();
    await vi.advanceTimersByTimeAsync(0);
    const audio = MockAudio.instances[0];
    const first = audio.src;
    audio.onerror?.();
    expect(audio.src).not.toBe(first);
    const calls = audio.play.mock.calls.length;
    audio.onerror?.();
    expect(audio.play).toHaveBeenCalledTimes(calls);
  });
});

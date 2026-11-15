import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AresSoundEngine } from "@/lib/soundEngine";

class MockAudio {
  static instances: MockAudio[] = [];
  static autoplayBlocked = false;
  src = "";
  volume = 0;
  loop = false;
  autoplay = false;
  preload = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = true;
  currentTime = 0;
  play = vi.fn(() => {
    if (MockAudio.autoplayBlocked) return Promise.reject({ name: "NotAllowedError" });
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => { this.paused = true; });
  constructor() { MockAudio.instances.push(this); }
}

describe("background music playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockAudio.instances = [];
    MockAudio.autoplayBlocked = false;
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tracks: ["/music/i-saac-charon.mp3", "/music/max-brhon-dark-soul.m4a"] }) }));
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("keeps music enabled by default and respects explicit mute", async () => {
    const engine = new AresSoundEngine();
    expect(engine.isEnabled()).toBe(true);
    engine.setEnabled(false);
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(0);
    expect(MockAudio.instances).toHaveLength(0);
    engine.toggle();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.isPlaying()).toBe(true);
  });

  it("starts Charon automatically on a fresh visit and fades from silence to full volume", async () => {
    vi.spyOn(Math,"random").mockReturnValue(0.99);
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    const audio = MockAudio.instances[0];
    expect(audio.autoplay).toBe(true);
    expect(audio.src).toBe("/music/i-saac-charon.mp3");
    expect(audio.loop).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.isPlaying()).toBe(true);
    expect(audio.volume).toBe(0);
    await vi.advanceTimersByTimeAsync(1600);
    expect(audio.volume).toBeCloseTo(0.5);
    await vi.advanceTimersByTimeAsync(1600);
    expect(audio.volume).toBe(1);
    audio.onended?.();
    expect(audio.src).toBe("/music/max-brhon-dark-soul.m4a");
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("does not depend on an AudioContext that the browser suspends", async () => {
    const contextConstructor = vi.fn(() => ({ state: "suspended", resume: () => new Promise<void>(() => {}) }));
    Object.assign(window,{AudioContext:contextConstructor});
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(3200);
    expect(contextConstructor).not.toHaveBeenCalled();
    expect(MockAudio.instances[0].volume).toBe(1);
    expect(engine.isPlaying()).toBe(true);
  });

  it("recovers on the first interaction when native autoplay is blocked", async () => {
    MockAudio.autoplayBlocked = true;
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.isEnabled()).toBe(true);
    expect(engine.isPlaying()).toBe(false);
    const listener = vi.mocked(window.addEventListener).mock.calls.find(([type]) => type === "pointerdown")?.[1];
    expect(listener).toBeTypeOf("function");
    MockAudio.autoplayBlocked = false;
    (listener as () => void)();
    await vi.advanceTimersByTimeAsync(3200);
    expect(engine.isPlaying()).toBe(true);
    expect(MockAudio.instances[0].src).toBe("/music/i-saac-charon.mp3");
    expect(MockAudio.instances[0].volume).toBe(1);
  });

  it("lets the sound button enable blocked playback instead of turning it off", async () => {
    MockAudio.autoplayBlocked = true;
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(0);
    const audio = MockAudio.instances[0];
    const listener = vi.mocked(window.addEventListener).mock.calls.find(([type]) => type === "pointerdown")?.[1];
    (listener as (event: unknown) => void)({ target: { closest: () => ({}) } });
    expect(audio.play).toHaveBeenCalledTimes(1);
    MockAudio.autoplayBlocked = false;
    engine.toggle();
    await vi.advanceTimersByTimeAsync(3200);
    expect(engine.isPlaying()).toBe(true);
    expect(audio.volume).toBe(1);
  });

  it("stops music in the console and resumes it only on presentation entry", async () => {
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(3200);
    const audio = MockAudio.instances[0];
    const track = audio.src;
    engine.leavePresentation();
    await vi.advanceTimersByTimeAsync(400);
    expect(engine.isPlaying()).toBe(false);
    expect(audio.paused).toBe(true);
    const plays = audio.play.mock.calls.length;
    audio.onended?.();
    engine.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.play).toHaveBeenCalledTimes(plays);
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(3200);
    expect(audio.src).toBe(track);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBe(1);
  });

  it("survives the mount-cleanup-remount sequence during development", async () => {
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    engine.leavePresentation();
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(3200);
    expect(MockAudio.instances).toHaveLength(1);
    expect(engine.isPlaying()).toBe(true);
    expect(MockAudio.instances[0].volume).toBe(1);
    expect(MockAudio.instances[0].paused).toBe(false);
  });

  it("skips broken tracks without retrying endlessly", async () => {
    const engine = new AresSoundEngine();
    engine.enterPresentation();
    await vi.advanceTimersByTimeAsync(0);
    const audio = MockAudio.instances[0];
    const first = audio.src;
    audio.onerror?.();
    expect(audio.src).not.toBe(first);
    const plays = audio.play.mock.calls.length;
    audio.onerror?.();
    expect(audio.play).toHaveBeenCalledTimes(plays);
  });
});

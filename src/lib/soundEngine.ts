import { pickMusicTrack } from "@/lib/musicPlaylist";

/** Local background music plus procedural UI/camera feedback. */

const BG_PLAYLIST = [
  "/music/i-saac-charon.mp3",
  "/music/max-brhon-dark-soul.m4a",
];
const FIRST_TRACK = "/music/i-saac-charon.mp3";
const PLAYBACK_REQUEST_VOLUME = 0.0001;
const MAX_MUSIC_VOLUME = 1;
const MUSIC_FADE_MS = 3200;

export class AresSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private presentationActive = true;
  private ambientGain: GainNode | null = null;
  private ambientOscA: OscillatorNode | null = null;
  private ambientOscB: OscillatorNode | null = null;
  private bgAudio: HTMLAudioElement | null = null;
  private bgTracks = [...BG_PLAYLIST];
  private bgCurrentTrack: string | null = null;
  private bgFailedTracks = new Set<string>();
  private bgPlayVersion = 0;
  private autoplayInitialized = false;
  private autoplayBlocked = false;
  private playing = false;
  private listeners = new Set<() => void>();
  private bgFadeTimer: number | null = null;
  private unlockHandler: ((event?: Event) => void) | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      try { this.ctx = new AudioCtx(); } catch { return null; }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isPlaying(): boolean { return this.playing; }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private setPlaying(next: boolean): void {
    if (this.playing === next) return;
    this.playing = next;
    this.listeners.forEach((listener) => listener());
  }

  public initAutoplay(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.autoplayInitialized) {
      this.autoplayInitialized = true;
      this.startBackgroundMusic();
      void this.loadMusicFolder();
    }
    return this.enabled;
  }

  public enterPresentation(): boolean {
    this.presentationActive = true;
    this.cancelBgFade();
    if (!this.autoplayInitialized) return this.initAutoplay();
    if (this.enabled) this.startBackgroundMusic();
    return this.enabled;
  }

  public leavePresentation(): void {
    if (!this.presentationActive) return;
    this.presentationActive = false;
    this.clearAutoplayUnlock();
    this.stopBgAudio(true);
  }

  private async loadMusicFolder(): Promise<void> {
    try {
      const response = await fetch("/api/music");
      if (!response.ok) return;
      const data = await response.json() as { tracks?: unknown };
      if (!Array.isArray(data.tracks)) return;
      this.bgTracks = data.tracks.filter((track): track is string => typeof track === "string" && track.startsWith("/music/"));
      if (this.enabled && (!this.bgCurrentTrack || this.bgFailedTracks.has(this.bgCurrentTrack))) this.nextBackgroundTrack();
    } catch {
      // Known local files still work if discovery is temporarily unavailable.
    }
  }

  private clearAutoplayUnlock(): void {
    if (typeof window === "undefined" || !this.unlockHandler) return;
    for (const evt of ["pointerdown", "keydown", "touchstart"] as const) {
      window.removeEventListener(evt, this.unlockHandler, true);
    }
    this.unlockHandler = null;
  }

  private armAutoplayUnlock(): void {
    if (typeof window === "undefined" || this.unlockHandler) return;
    this.unlockHandler = (event) => {
      // Let the sound button handle its own click; unlocking on pointerdown would mute it on click.
      const target = event?.target as Element | null | undefined;
      if (target && typeof target.closest === "function" && target.closest("[data-sound-toggle]")) return;
      this.clearAutoplayUnlock();
      if (this.enabled) {
        this.startBackgroundMusic();
      }
    };
    for (const evt of ["pointerdown", "keydown", "touchstart"] as const) {
      window.addEventListener(evt, this.unlockHandler, { capture: true, passive: true });
    }
  }

  public setEnabled(next: boolean): boolean {
    this.enabled = next;
    if (next) {
      this.clearAutoplayUnlock();
      this.startBackgroundMusic();
      this.playHoverTick();
    } else {
      this.autoplayBlocked = false;
      this.clearAutoplayUnlock();
      this.stopBgAudio();
      this.stopAmbient();
    }
    this.listeners.forEach((listener) => listener());
    return this.enabled;
  }

  private startBackgroundMusic(): void {
    if (!this.enabled || !this.presentationActive || typeof window === "undefined" || typeof Audio === "undefined") return;
    if (!this.bgAudio) {
      this.bgAudio = new Audio();
      this.bgAudio.preload = "auto";
      this.bgAudio.loop = false;
      this.bgAudio.volume = PLAYBACK_REQUEST_VOLUME;
      this.bgAudio.autoplay = true;
      this.bgAudio.onended = () => { if (this.enabled) this.nextBackgroundTrack(); };
      this.bgAudio.onerror = () => {
        this.setPlaying(false);
        if (this.bgCurrentTrack) this.bgFailedTracks.add(this.bgCurrentTrack);
        if (this.enabled) this.nextBackgroundTrack();
      };
    }
    if (!this.bgCurrentTrack) {
      this.nextBackgroundTrack();
      return;
    }
    const version = ++this.bgPlayVersion;
    const audio = this.bgAudio;
    // Background music uses native HTML audio only. A suspended Web Audio context
    // for interface effects must never prevent an otherwise permitted music autoplay.
    if (audio.volume === 0) audio.volume = PLAYBACK_REQUEST_VOLUME;
    void audio.play().then(() => {
      if (!this.enabled || !this.presentationActive || version !== this.bgPlayVersion) return;
      this.autoplayBlocked = false;
      this.clearAutoplayUnlock();
      audio.volume = 0;
      this.fadeAudioTo(audio,MAX_MUSIC_VOLUME,MUSIC_FADE_MS);
      this.setPlaying(true);
    }).catch((error: unknown) => {
      if (!this.enabled || version !== this.bgPlayVersion) return;
      const name = error && typeof error === "object" && "name" in error ? error.name : "";
      if (name === "NotAllowedError") {
        this.setPlaying(false);
        this.autoplayBlocked = true;
        this.armAutoplayUnlock();
      }
      else if (name !== "AbortError") {
        if (this.bgCurrentTrack) this.bgFailedTracks.add(this.bgCurrentTrack);
        this.nextBackgroundTrack();
      }
    });
  }

  private nextBackgroundTrack(): void {
    const available = this.bgTracks.filter((track) => !this.bgFailedTracks.has(track));
    const next = !this.bgCurrentTrack && available.includes(FIRST_TRACK)
      ? FIRST_TRACK
      : pickMusicTrack(available, this.bgCurrentTrack);
    if (!next || !this.enabled || !this.presentationActive) return;
    this.setPlaying(false);
    if (!this.bgAudio) { this.startBackgroundMusic(); return; }
    this.cancelBgFade();
    this.bgAudio.volume = PLAYBACK_REQUEST_VOLUME;
    this.bgCurrentTrack = next;
    this.bgAudio.src = next;
    this.startBackgroundMusic();
  }

  private fadeAudioTo(
    audio: HTMLAudioElement,
    targetVol: number,
    durationMs: number,
    onDone?: () => void
  ): void {
    this.cancelBgFade();
    const startVol = audio.volume;
    const steps = Math.max(1,Math.min(80,Math.floor(durationMs/16)));
    const stepMs = Math.max(16, Math.round(durationMs / steps));
    const startedAt = Date.now();
    this.bgFadeTimer = window.setInterval(() => {
      const t = Math.min(1,(Date.now()-startedAt)/durationMs);
      audio.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * t));
      if (t >= 1) {
        if (this.bgFadeTimer !== null) {
          window.clearInterval(this.bgFadeTimer);
          this.bgFadeTimer = null;
        }
        onDone?.();
      }
    }, stepMs);
  }

  private cancelBgFade(): void {
    if (this.bgFadeTimer === null) return;
    window.clearInterval(this.bgFadeTimer);
    window.clearTimeout(this.bgFadeTimer);
    this.bgFadeTimer = null;
  }

  private stopBgAudio(forcePause = false): void {
    this.setPlaying(false);
    this.bgPlayVersion++;
    if (!this.bgAudio) return;
    const audio = this.bgAudio;
    this.fadeAudioTo(audio, 0, 320, () => {
      if (!this.enabled || (forcePause && !this.presentationActive)) {
        audio.pause();
      }
    });
  }

  public toggle(): boolean {
    if (this.enabled && !this.playing) return this.setEnabled(true);
    return this.setEnabled(!this.enabled);
  }

  private startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.ambientOscA) return;

    try {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(140, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 1.2);

      const oscA = ctx.createOscillator();
      oscA.type = "sine";
      oscA.frequency.setValueAtTime(55, ctx.currentTime);

      const oscB = ctx.createOscillator();
      oscB.type = "triangle";
      oscB.frequency.setValueAtTime(82.41, ctx.currentTime);

      const oscBGain = ctx.createGain();
      oscBGain.gain.setValueAtTime(0.35, ctx.currentTime);

      oscA.connect(filter);
      oscB.connect(oscBGain);
      oscBGain.connect(filter);
      filter.connect(master);
      master.connect(ctx.destination);

      oscA.start();
      oscB.start();

      this.ambientGain = master;
      this.ambientOscA = oscA;
      this.ambientOscB = oscB;
    } catch {
      // Ignore Web Audio restrictions if blocked by browser policy
    }
  }

  private stopAmbient(): void {
    if (!this.ctx || !this.ambientGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    try {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);

      const oscA = this.ambientOscA;
      const oscB = this.ambientOscB;
      setTimeout(() => {
        try {
          oscA?.stop();
          oscB?.stop();
          oscA?.disconnect();
          oscB?.disconnect();
        } catch {
          // Ignore already stopped oscillators
        }
      }, 280);
    } finally {
      this.ambientGain = null;
      this.ambientOscA = null;
      this.ambientOscB = null;
    }
  }

  public playHoverTick(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.03);

      gain.gain.setValueAtTime(0.022, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    } catch {
      // Ignore
    }
  }

  public playCameraWhoosh(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.22);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.22);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }

  public playAlertPulse(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      for (const offset of [0, 0.16]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(offset === 0 ? 520 : 440, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.025, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      }
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new AresSoundEngine();

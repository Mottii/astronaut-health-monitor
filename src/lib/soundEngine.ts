/**
 * Procedural Web Audio API synthesizer for ARES-MED OS.
 * Provides subtle spacecraft ambient hum and tactile UI/camera feedback
 * without external audio asset downloads.
 */

const BG_PLAYLIST = [
  "/audio/dark-soul.m4a",
  "/audio/deep-techno-ambience.mp3",
];

class AresSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private ambientGain: GainNode | null = null;
  private ambientOscA: OscillatorNode | null = null;
  private ambientOscB: OscillatorNode | null = null;
  private bgAudio: HTMLAudioElement | null = null;
  private bgTrackIndex = 0;
  private bgFadeTimer: number | null = null;
  private bgUnavailable = false;
  private unlockHandler: (() => void) | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public initAutoplay(): boolean {
    if (typeof window === "undefined") return false;
    if (this.enabled) return true;
    this.enabled = true;
    this.startBackgroundOrAmbient(true);
    return true;
  }

  private clearAutoplayUnlock(): void {
    if (typeof window === "undefined" || !this.unlockHandler) return;
    for (const evt of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
      window.removeEventListener(evt, this.unlockHandler, true);
    }
    this.unlockHandler = null;
  }

  private armAutoplayUnlock(): void {
    if (typeof window === "undefined" || this.unlockHandler) return;
    this.unlockHandler = () => {
      this.clearAutoplayUnlock();
      if (this.enabled) {
        this.startBackgroundOrAmbient(false);
      }
    };
    for (const evt of ["pointerdown", "keydown", "touchstart", "wheel"] as const) {
      window.addEventListener(evt, this.unlockHandler, { capture: true, passive: true });
    }
  }

  public setEnabled(next: boolean): boolean {
    this.enabled = next;
    if (next) {
      this.clearAutoplayUnlock();
      this.startBackgroundOrAmbient(false);
      this.playHoverTick();
    } else {
      this.clearAutoplayUnlock();
      this.stopBgAudio();
      this.stopAmbient();
    }
    return this.enabled;
  }

  private startBackgroundOrAmbient(fromAutoplay = false): void {
    if (typeof window === "undefined") return;
    if (this.bgUnavailable) {
      if (!fromAutoplay) this.startAmbient();
      else this.armAutoplayUnlock();
      return;
    }

    if (!this.bgAudio) {
      const audio = new Audio(BG_PLAYLIST[this.bgTrackIndex]);
      audio.preload = "auto";
      audio.volume = 0;
      audio.addEventListener("ended", () => {
        this.bgTrackIndex = (this.bgTrackIndex + 1) % BG_PLAYLIST.length;
        audio.src = BG_PLAYLIST[this.bgTrackIndex];
        if (this.enabled) {
          void audio.play().catch(() => {});
        }
      });
      audio.addEventListener("error", () => {
        this.bgUnavailable = true;
        this.bgAudio = null;
        if (this.enabled) {
          this.startAmbient();
        }
      });
      this.bgAudio = audio;
    }

    const audio = this.bgAudio;
    void audio
      .play()
      .then(() => {
        if (!this.enabled) return;
        this.clearAutoplayUnlock();
        this.fadeAudioTo(audio, 0.24, 900);
      })
      .catch(() => {
        if (!this.enabled) return;
        if (fromAutoplay) {
          this.armAutoplayUnlock();
        } else {
          this.startAmbient();
        }
      });
  }

  private fadeAudioTo(
    audio: HTMLAudioElement,
    targetVol: number,
    durationMs: number,
    onDone?: () => void
  ): void {
    if (this.bgFadeTimer !== null) {
      window.clearInterval(this.bgFadeTimer);
      this.bgFadeTimer = null;
    }
    const startVol = audio.volume;
    const steps = 20;
    const stepMs = Math.max(16, Math.round(durationMs / steps));
    let step = 0;
    this.bgFadeTimer = window.setInterval(() => {
      step += 1;
      const t = Math.min(1, step / steps);
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

  private stopBgAudio(): void {
    if (!this.bgAudio) return;
    const audio = this.bgAudio;
    this.fadeAudioTo(audio, 0, 320, () => {
      if (!this.enabled) {
        audio.pause();
      }
    });
  }

  public toggle(): boolean {
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

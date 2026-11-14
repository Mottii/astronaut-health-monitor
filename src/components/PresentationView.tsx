"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Compass,
  Activity,
  Pause,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BioTwin3DStage, type FocusProjection } from "@/components/BioTwin3DStage";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BRIEFING_EXIT_MS, BRIEFING_TRANSITION_MS } from "@/lib/presentationMotion";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";
import type { SpaceWeatherStatus } from "@/lib/nasaApi";
import { soundEngine } from "@/lib/soundEngine";
import type {
  BodySystemId,
  EnvironmentTelemetry,
  HealthEvaluationResult,
  VitalReadings,
} from "@/types/health";

export interface PresentationViewProps {
  slideIndex: number;
  onSelectSlide: (index: number) => void;
  onOpenConsole: () => void;
  evaluation: HealthEvaluationResult;
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
  selectedSystem: BodySystemId;
  onSelectSystem: (systemId: BodySystemId) => void;
  isSyncingWeather: boolean;
  onSyncSpaceWeather: () => void;
  spaceWeather: SpaceWeatherStatus | null;
}

const CHAPTER_MECHANISM: Record<string, [string, string, string]> = {
  "neuro-ocular-sans": ["FLUID SHIFT + CO₂", "NEURO-OCULAR LOAD", "GUIDED EYE EXAM"],
  "cardiovascular-adaptation": ["MICROGRAVITY", "VASCULAR ADAPTATION", "CHECK HR + BP"],
  "renal-bone-calcium": ["BONE UNLOADING", "RENAL CASCADE", "HYDRATION + ARED"],
  "radiation-immune": ["SOLAR EXPOSURE", "IMMUNE RESPONSE", "RADIATION REVIEW"],
  "metabolic-circadian": ["SLEEP + ISOLATION", "METABOLIC DRIFT", "GLUCOSE REVIEW"],
};

export function PresentationView({
  slideIndex,
  onSelectSlide,
  onOpenConsole,
  evaluation,
  vitals,
  envTelemetry,
  selectedSystem,
  onSelectSystem,
  isSyncingWeather,
  onSyncSpaceWeather,
  spaceWeather,
}: PresentationViewProps) {
  const slide = PRESENTATION_SLIDES[slideIndex] ?? PRESENTATION_SLIDES[0];
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [introOpen, setIntroOpen] = useState<boolean>(true);

  useEffect(() => {
    setSoundOn(soundEngine.initAutoplay());
  }, []);
  const [inspectMode, setInspectMode] = useState<boolean>(false);
  const [cameraResetToken, setCameraResetToken] = useState<number>(0);
  const [sceneCue, setSceneCue] = useState(0);
  const [introClosing, setIntroClosing] = useState(false);
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle");
  const systemReducedMotion = useReducedMotion();
  const [motionPreference, setMotionPreference] = useState<"system" | "full" | "reduced">("system");
  const reducedMotion = motionPreference === "reduced" || (motionPreference === "system" && systemReducedMotion);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const transitionLockedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const introTimerRef = useRef<number | null>(null);
  const pendingSlideRef = useRef<number | null>(null);
  const navigateRef = useRef<(index: number) => void>(() => {});
  const mechanism = CHAPTER_MECHANISM[slide.id];
  const showFocus = !introOpen && !inspectMode && slide.cameraPreset !== "full";

  const finishTransition = useCallback(() => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    transitionLockedRef.current = false;
    setPhase("idle");
    rootRef.current?.style.setProperty("--flight", "1");
    const pending = pendingSlideRef.current;
    pendingSlideRef.current = null;
    if (pending !== null) navigateRef.current(pending);
  }, []);

  const updateProjection = useCallback((point: FocusProjection) => {
    if (focusRef.current) {
      focusRef.current.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
      focusRef.current.style.visibility = point.visible ? "visible" : "hidden";
    }
    if (leaderRef.current) {
      const startX = point.width >= 1024 ? 297 : 28;
      const startY = point.height * 0.46;
      const bendX = Math.max(startX + 24, point.x - 80);
      leaderRef.current.setAttribute("d", `M ${startX} ${startY} L ${bendX} ${startY} L ${point.x - 35} ${point.y} L ${point.x - 18} ${point.y}`);
      leaderRef.current.style.visibility = point.visible ? "visible" : "hidden";
    }
  }, []);
  const updateProgress = useCallback((progress: number) => {
    rootRef.current?.style.setProperty("--flight", String(progress));
  }, []);

  const wheelCooldownUntilRef = useRef<number>(0);
  const wheelGestureConsumedRef = useRef<boolean>(false);
  const wheelIdleTimerRef = useRef<number | null>(null);


  useEffect(() => {
    return () => {
      for (const timer of [wheelIdleTimerRef, exitTimerRef, settleTimerRef, introTimerRef]) {
        if (timer.current !== null) window.clearTimeout(timer.current);
      }
    };
  }, []);

  function goToSlide(nextIdx: number, direct = false) {
    const clamped = Math.max(0, Math.min(PRESENTATION_SLIDES.length - 1, nextIdx));
    if (clamped === slideIndex) return;
    if (transitionLockedRef.current) {
      if (direct) pendingSlideRef.current = clamped;
      return;
    }
    transitionLockedRef.current = true;
    setInspectMode(false);
    setPhase(reducedMotion ? "entering" : "leaving");
    rootRef.current?.style.setProperty("--flight", "0");
    soundEngine.playCameraWhoosh();
    exitTimerRef.current = window.setTimeout(() => {
      onSelectSlide(clamped);
      setPhase("entering");
      setSceneCue((value) => value + 1);
      // An unloaded / unavailable WebGL scene must never strand navigation.
      settleTimerRef.current = window.setTimeout(finishTransition, reducedMotion ? 80 : BRIEFING_TRANSITION_MS + 300);
    }, reducedMotion ? 0 : BRIEFING_EXIT_MS);
  }
  navigateRef.current = (index) => goToSlide(index);

  function handlePrimaryCta() {
    soundEngine.playHoverTick();
    if (slideIndex >= PRESENTATION_SLIDES.length - 1) {
      onOpenConsole();
      return;
    }
    goToSlide(slideIndex + 1);
  }

  function handleToggleSound() {
    const next = soundEngine.toggle();
    setSoundOn(next);
  }

  function enterBriefing(withAudio: boolean, animate = true) {
    // The visitor explicitly chooses the animated experience even when the OS reduces motion.
    setMotionPreference(animate ? "full" : "reduced");
    if (withAudio) {
      setSoundOn(soundEngine.setEnabled(true));
    } else {
      setSoundOn(soundEngine.setEnabled(false));
    }
    if (introClosing) return;
    setIntroClosing(true);
    introTimerRef.current = window.setTimeout(() => {
      setIntroOpen(false);
      setIntroClosing(false);
      setSceneCue((value) => value + 1);
      setPhase("entering");
      transitionLockedRef.current = true;
      settleTimerRef.current = window.setTimeout(finishTransition, animate ? BRIEFING_TRANSITION_MS + 300 : 80);
    }, animate ? 520 : 0);
  }

  // Keyboard navigation (Arrow keys / PageUp / PageDown)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.repeat || target?.isContentEditable) return;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (introOpen) {
        if (e.key === "Enter" || e.key === " ") {
          if (target?.tagName === "BUTTON") return;
          e.preventDefault();
          enterBriefing(false);
        }
        return;
      }

      if (e.key === "Escape" && inspectMode) {
        e.preventDefault();
        setInspectMode(false);
        setCameraResetToken((n) => n + 1);
        return;
      }

      if (inspectMode) return;
      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        goToSlide(slideIndex + 1);
      } else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "PageUp"
      ) {
        e.preventDefault();
        goToSlide(slideIndex - 1);
      } else if (e.key === " ") {
        if (target?.tagName === "BUTTON" || target?.tagName === "A") return;
        e.preventDefault();
        goToSlide(slideIndex + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Trackpad-safe wheel navigation: one gesture = max one slide transition
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (introOpen || inspectMode) return;
    if (wheelIdleTimerRef.current !== null) {
      window.clearTimeout(wheelIdleTimerRef.current);
    }
    wheelIdleTimerRef.current = window.setTimeout(() => {
      wheelGestureConsumedRef.current = false;
    }, 170);

    if (Math.abs(e.deltaY) < 24) return;
    const now = performance.now();
    if (wheelGestureConsumedRef.current || now < wheelCooldownUntilRef.current) {
      return;
    }

    wheelGestureConsumedRef.current = true;
    wheelCooldownUntilRef.current = now + BRIEFING_EXIT_MS + BRIEFING_TRANSITION_MS;

    if (e.deltaY > 0) {
      goToSlide(slideIndex + 1);
    } else {
      goToSlide(slideIndex - 1);
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="cinematic-briefing"
      data-phase={phase}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-focus={showFocus ? "true" : "false"}
      data-slide={slide.id}
      onWheel={handleWheel}
      className="ares-briefing relative h-dvh w-full overflow-hidden bg-[#06070a] text-white select-none"
    >
      {/* Fullscreen 3D Astronaut Stage */}
      <div className="absolute inset-0 z-0">
        <BioTwin3DStage
          assessments={evaluation.systems}
          cascades={evaluation.activeCascades}
          selectedSystem={selectedSystem}
          onSelectSystem={onSelectSystem}
          vitals={vitals}
          envTelemetry={envTelemetry}
          visualMode={slide.visualMode}
          cinematic={true}
          sceneCue={sceneCue}
          inspectEnabled={inspectMode}
          onFocusProjection={updateProjection}
          onTransitionProgress={updateProgress}
          onCameraTransitionEnd={finishTransition}
          reducedMotionOverride={reducedMotion}
          autoRotate={false}
          cameraResetToken={cameraResetToken}
          cameraPreset={introOpen || inspectMode ? "full" : slide.cameraPreset}
          enableParallax={!inspectMode}
          allowWheelZoom={inspectMode}
          hideBottomHud={true}
          calloutFilter={inspectMode ? "selected" : "none"}
        />
      </div>

      {/* Subtle Vignette & Edge Readability Gradients */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 50% 44%, rgba(6,7,10,0) 28%, rgba(6,7,10,0.68) 100%), linear-gradient(to top, rgba(6,7,10,0.92) 0%, rgba(6,7,10,0.45) 26%, rgba(6,7,10,0) 52%)",
        }}
      />

      {/* Projected markers stay attached to the moving anatomy, not fixed to a slide. */}
      <div className="ares-focus-layer pointer-events-none absolute inset-0 z-20" aria-hidden="true">
        <svg className="ares-leader absolute inset-0 hidden h-full w-full lg:block">
          <path ref={leaderRef} fill="none" stroke="currentColor" strokeWidth="0.8" pathLength="1" />
        </svg>
        <div ref={focusRef} className="ares-focus-anchor absolute left-0 top-0">
          <div key={`${slide.id}-reticle`} className="ares-focus-brackets" />
          <span className="ares-focus-tag font-mono">{slide.chapterLabel} <span> / {slide.visualMode.toUpperCase()}</span></span>
        </div>
      </div>
      <div className="ares-flight-track pointer-events-none absolute inset-x-0 top-0 z-30" aria-hidden="true"><span /></div>

      {/* Top Architectural Frame Bar (28px unified HUD margin) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-7 sm:py-7">
        {/* Brand */}
        <button
          type="button"
          onClick={() => {
            setCameraResetToken((n) => n + 1);
            goToSlide(0);
          }}
          className="pointer-events-auto flex shrink-0 items-center gap-2.5 whitespace-nowrap text-left transition opacity-90 hover:opacity-100"
        >
          <svg
            viewBox="0 0 32 32"
            className="h-5 w-5 text-white"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 26L14.5 6H18.5L28 26H23.2L16.5 11.4L9.2 26H4Z"
              fill="currentColor"
            />
            <path
              d="M5 20.5C11.5 14 20.5 11 29 9.5"
              stroke="#06070a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-mono text-xs font-semibold tracking-[0.22em] text-white">
            ARES-MED
          </span>
        </button>

        {/* Top-Right Inspect Toggle + Console Action */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={reducedMotion ? "Enable full animation" : "Reduce animation"}
            aria-pressed={!reducedMotion}
            onClick={() => {
              setMotionPreference(reducedMotion ? "full" : "reduced");
              if (!reducedMotion) finishTransition();
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 font-mono text-[10px] tracking-[0.12em] text-white/70 backdrop-blur-md transition hover:border-white/35 hover:text-white"
          >
            {reducedMotion ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Activity className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />}
            <span className="hidden lg:inline">{reducedMotion ? "REDUCED MOTION" : "MOTION ON"}</span>
          </button>
          {inspectMode && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick();
                setCameraResetToken((n) => n + 1);
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 font-mono text-[10px] font-medium tracking-[0.16em] text-white/80 backdrop-blur-md transition hover:border-white/35 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">RESET VIEW</span>
            </button>
          )}
          <button
            type="button"
            aria-label={inspectMode ? "Return to briefing" : "Inspect 3D model"}
            onClick={() => {
              soundEngine.playHoverTick();
              setInspectMode((prev) => !prev);
            }}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 font-mono text-[10px] font-semibold tracking-[0.16em] backdrop-blur-md transition ${
              inspectMode
                ? "border-sky-400/60 bg-sky-400/20 text-sky-200 hover:bg-sky-400/30"
                : "border-white/15 bg-white/[0.06] text-white/80 hover:border-white/35 hover:text-white"
            }`}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{inspectMode ? "BRIEFING" : "INSPECT 3D"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playHoverTick();
              onOpenConsole();
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 font-mono text-[10px] font-semibold tracking-[0.18em] text-white backdrop-blur-md transition hover:border-white hover:bg-white hover:text-[#06070a]"
          >
            <span className="hidden sm:inline">CMO CONSOLE</span><span className="sm:hidden">CMO</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Left Compact HUD: Diagnostic Summary on Slide 07 or Earth vs. Spaceflight Metrics on 02-06 */}
      {slide.id === "cmo-handoff" ? (
        <aside
          key={`${slide.id}-summary`}
          aria-label="Diagnostic Summary"
          style={{ animationDelay: "260ms" }}
          className="ares-telemetry ares-choreo-enter pointer-events-auto absolute top-1/2 left-5 z-30 hidden w-[268px] -translate-y-1/2 flex-col gap-2.5 sm:left-7 lg:flex"
        >
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-[0.18em] text-white/45">
            <span>DIAGNOSTIC SUMMARY</span>
            <span className="text-white/35">CMO READY</span>
          </div>

          <div className="rounded-xl border border-white/12 bg-[#060a12]/58 p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.12em] text-white/65">
                CREW READINESS
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider ${
                  evaluation.overallStatus === "green"
                    ? "text-emerald-300"
                    : evaluation.overallStatus === "amber"
                      ? "text-amber-300"
                      : "text-red-300"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      evaluation.overallStatus === "green"
                        ? "#34D399"
                        : evaluation.overallStatus === "amber"
                          ? "#FBBF24"
                          : "#F87171",
                  }}
                />
                {evaluation.overallStatus === "green"
                  ? "NOMINAL"
                  : evaluation.overallStatus === "amber"
                    ? "CAUTION"
                    : "CRITICAL"}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-2xl font-semibold text-white">
              {evaluation.readinessScore}
              <span className="text-xs font-normal text-white/45"> / 100</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/[0.08] pt-2.5">
              {(
                [
                  ["neuro_ocular", "NEURO"],
                  ["cardiovascular", "CARDIO"],
                  ["musculoskeletal_renal", "RENAL"],
                  ["immune_hematology", "IMMUNE"],
                  ["metabolic_endocrine", "METAB"],
                  ["behavioral_circadian", "CIRCAD"],
                ] as const
              ).map(([sysKey, shortName]) => {
                const sys = evaluation.systems[sysKey];
                const dotHex =
                  sys.status === "green"
                    ? "#34D399"
                    : sys.status === "amber"
                      ? "#FBBF24"
                      : "#F87171";
                return (
                  <div
                    key={sysKey}
                    className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 font-mono text-[9.5px]"
                  >
                    <span className="flex items-center gap-1.5 text-white/75">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: dotHex }}
                      />
                      {shortName}
                    </span>
                    <span className="font-semibold text-white">{sys.score}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {(evaluation.activeCascades[0]?.immediateAction ||
            evaluation.systems[selectedSystem]?.recommendedActions[0]) && (
            <div className="rounded-xl border border-sky-400/25 bg-[#060a12]/58 p-3.5 backdrop-blur-md">
              <span className="block font-mono text-[9.5px] tracking-[0.16em] text-sky-300/85">
                PRIORITY CMO ACTION
              </span>
              <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                {evaluation.activeCascades[0]?.immediateAction ??
                  evaluation.systems[selectedSystem]?.recommendedActions[0]}
              </p>
            </div>
          )}
        </aside>
      ) : (
        slideIndex > 0 && (
        <aside
          key={`${slide.id}-telemetry`}
          aria-label="Slide Telemetry Comparison"
          className="ares-telemetry pointer-events-auto absolute top-1/2 left-5 z-30 hidden w-[268px] -translate-y-1/2 flex-col gap-2.5 sm:left-7 lg:flex"
        >
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-[0.18em] text-white/45">
            <span>EARTH VS SPACE</span>
            <span className="text-white/35">{slide.osdrRefs[0] ?? "NASA HRP"}</span>
          </div>

          {slide.metrics.map((metric, idx) => (
            <div
              key={`${slide.id}-${metric.label}`}
              style={{ animationDelay: `${650 + idx * 140}ms` }}
              className="ares-choreo-enter rounded-xl border border-white/12 bg-[#060a12]/48 p-3.5 backdrop-blur-md transition-colors duration-200 hover:border-white/28"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.08em] text-white/70">
                  {metric.label}
                </span>
                {metric.critical && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-2.5">
                <div>
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-white/40">
                    Earth 1g
                  </span>
                  <span className="mt-0.5 block font-mono text-sm font-medium text-white/75">
                    {metric.earthValue}
                  </span>
                </div>
                <div>
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-sky-300/80">
                    Spaceflight
                  </span>
                  <span
                    className={`mt-0.5 block font-mono text-sm font-semibold ${
                      metric.critical ? "text-amber-300" : "text-sky-300"
                    }`}
                  >
                    {metric.spaceValue}
                  </span>
                </div>
              </div>

              <span className="mt-1.5 block font-mono text-[9px] text-white/35">
                Unit: {metric.unit}
              </span>
            </div>
          ))}

          {mechanism && (
            <div key={`${slide.id}-mechanism`} className="ares-mechanism rounded-xl border border-white/10 bg-[#060a12]/60 p-3.5 backdrop-blur-md">
              <span className="font-mono text-[9px] tracking-[0.18em] text-white/35">CASCADE / DEMO SCENARIO</span>
              {mechanism.map((step, index) => (
                <div key={step} className="ares-mechanism-step mt-2 flex items-center gap-2 font-mono text-[9px] tracking-wider" style={{ animationDelay: `${1050 + index * 150}ms` }}>
                  <span className="text-sky-300/45">0{index + 1}</span><span className={index === 2 ? "text-sky-200" : "text-white/70"}>{step}</span>
                </div>
              ))}
              {slide.id === "cardiovascular-adaptation" && (
                <div className="ares-pulse mt-3" style={{ "--beat": `${60 / Math.max(30, vitals.heartRateBpm)}s` } as React.CSSProperties}>
                  <svg viewBox="0 0 220 30" aria-hidden="true"><path d="M0 18 H32 L37 15 L42 18 H65 L70 21 L76 3 L83 27 L89 18 H118 L125 13 L133 18 H220" /></svg>
                  <span className="mt-1 block font-mono text-[8px] tracking-wider text-white/35">HR-SYNCED ILLUSTRATION · {vitals.heartRateBpm} BPM</span>
                </div>
              )}
            </div>
          )}
          {slide.id === "radiation-immune" && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playHoverTick();
                onSyncSpaceWeather();
              }}
              disabled={isSyncingWeather}
              className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 font-mono text-[10px] font-medium tracking-[0.14em] text-sky-200 backdrop-blur-md transition hover:border-sky-400/60 hover:bg-sky-400/20 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3 w-3 ${isSyncingWeather ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {isSyncingWeather
                ? "SYNCING NASA DONKI..."
                : spaceWeather
                  ? `DONKI: ${spaceWeather.summary}`
                  : "SYNC LIVE NASA DONKI"}
            </button>
          )}
        </aside>
      ))}

      {/* Right Vertical Chapter Rail (Hubtown Style, 28px margin, right-aligned) */}
      <nav
        aria-label="Presentation Chapters"
        className="pointer-events-auto absolute top-1/2 right-5 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 sm:right-7 md:flex"
      >
        {PRESENTATION_SLIDES.map((item, idx) => {
          const isActive = idx === slideIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToSlide(idx, true)}
              onMouseEnter={() => soundEngine.playHoverTick()}
              aria-current={isActive ? "step" : undefined}
              className="ares-chapter group flex cursor-pointer items-center justify-end gap-3 text-right transition"
            >
              <span
                className={`font-mono text-[10px] tracking-[0.2em] transition-colors ${
                  isActive
                    ? "font-semibold text-white"
                    : "text-white/35 group-hover:text-white/75"
                }`}
              >
                {item.chapterCode} · {item.chapterLabel}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  isActive
                    ? "scale-125 bg-sky-400 shadow-[0_0_10px_#38bdf8]"
                    : "bg-white/20 group-hover:bg-white/55"
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* Bottom Center Slide Headline & CTA (Hubtown Hero Placement) */}
      <section
        key={`${slide.id}-hero`}
        style={{ animationDelay: "300ms" }}
        className="ares-hero ares-choreo-enter pointer-events-none absolute inset-x-0 bottom-14 z-30 mx-auto flex max-w-2xl flex-col items-center px-5 text-center sm:bottom-12"
      >
        <span className="font-mono text-[10px] tracking-[0.24em] text-sky-300/90">
          {slide.kicker}
        </span>

        <h1 className="ares-scan-title pointer-events-auto mt-2.5 text-2xl font-semibold tracking-[0.06em] text-white text-balance sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
          {slide.title}
        </h1>

        <p className="mt-2.5 max-w-xl text-xs leading-relaxed text-white/65 text-balance sm:text-sm">
          {slide.summary}
        </p>

        {/* Mobile Compact Metrics Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:hidden">
          {slide.metrics.map((m) => (
            <span
              key={m.label}
              className="rounded-full border border-white/10 bg-[#0d0e11]/75 px-3 py-1 font-mono text-[10px] text-white/80 backdrop-blur-md"
            >
              {m.label}:{" "}
              <strong className={m.critical ? "text-amber-300" : "text-sky-300"}>
                {m.spaceValue}
              </strong>{" "}
              <span className="text-white/40">(vs {m.earthValue})</span>
            </span>
          ))}
        </div>

        <div className="pointer-events-auto mt-5 flex items-center gap-2.5">
          {slideIndex > 0 && (
            <button
              type="button"
              onClick={() => goToSlide(slideIndex - 1)}
              aria-label="Previous slide"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] text-white/75 backdrop-blur-md transition hover:border-white/35 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePrimaryCta}
            className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-white/25 bg-white/10 px-5 font-mono text-[11px] font-semibold tracking-[0.18em] text-white backdrop-blur-md transition hover:border-white hover:bg-white hover:text-[#06070a] active:scale-[0.98]"
          >
            <span>{slide.ctaLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Bottom Corner Controls (shifted past Next.js dev badge on bottom-left; minimal counter on bottom-right) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 py-5 sm:px-7 sm:py-7">
        <button
          type="button"
          onClick={handleToggleSound}
          className="pointer-events-auto ml-12 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-white/75 backdrop-blur-md transition hover:border-white/35 hover:text-white sm:ml-14"
        >
          {soundOn ? (
            <Volume2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
          )}
          <span>{soundOn ? "SOUND ON" : "SOUND OFF"}</span>
        </button>

        <span className="font-mono text-[10px] tracking-[0.22em] text-white/55">
          {slide.chapterCode} /{" "}
          {String(PRESENTATION_SLIDES.length).padStart(2, "0")}
        </span>
      </div>

      {/* Intro Portal Gate (Active Theory Style) */}
      {introOpen && (
        <div role="dialog" aria-modal="true" aria-label="Start mission briefing" data-closing={introClosing} className="ares-intro absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#06070a]/65 px-6 text-center backdrop-blur-md">
          <div className="ares-boot-orbit" aria-hidden="true"><span /><span /></div>
          <span className="font-mono text-[10px] tracking-[0.28em] text-sky-300/85">
            NASA SPACE APPS CHALLENGE 2026 // ALMATY
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-[0.12em] text-white sm:text-5xl">
            ARES-MED OS
          </h2>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-white/60 sm:text-sm">
            Interactive 3D BioTwin organ-cascade briefing &amp; autonomous Chief
            Medical Officer console for deep-space missions.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => enterBriefing(true)}
              className="inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-lg bg-white px-6 font-mono text-[11px] font-semibold tracking-[0.18em] text-[#06070a] transition hover:bg-sky-100 active:scale-[0.98]"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PLAY ANIMATED BRIEFING</span>
            </button>
            <button
              type="button"
              onClick={() => enterBriefing(false)}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-white/85 transition hover:border-white/40 hover:text-white"
            >
              <span>PLAY SILENT</span>
            </button>
          </div>
          <button type="button" onClick={() => enterBriefing(false, false)} className="mt-5 font-mono text-[9px] tracking-[0.14em] text-white/45 underline-offset-4 hover:text-white hover:underline">
            USE REDUCED MOTION
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BioTwin3DStage } from "@/components/BioTwin3DStage";
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

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+-";

function useScrambleText(targetText: string): string {
  const [display, setDisplay] = useState(targetText);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 14;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = frame / totalFrames;
      const resolvedCount = Math.floor(targetText.length * progress);
      let next = "";
      for (let i = 0; i < targetText.length; i++) {
        const ch = targetText[i];
        if (ch === " " || ch === "&" || ch === "→" || i < resolvedCount) {
          next += ch;
        } else {
          next += SCRAMBLE_CHARS[(i * 7 + frame * 3) % SCRAMBLE_CHARS.length];
        }
      }
      setDisplay(next);
      if (frame >= totalFrames) {
        window.clearInterval(timer);
        setDisplay(targetText);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [targetText]);

  return display;
}

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
  const [soundOn, setSoundOn] = useState<boolean>(() => soundEngine.isEnabled());
  const [introOpen, setIntroOpen] = useState<boolean>(true);
  const [cameraResetToken, setCameraResetToken] = useState<number>(0);

  const lastWheelAtRef = useRef<number>(0);
  const scrambledTitle = useScrambleText(slide.title);

  function goToSlide(nextIdx: number) {
    const clamped = Math.max(
      0,
      Math.min(PRESENTATION_SLIDES.length - 1, nextIdx)
    );
    if (clamped === slideIndex) return;

    const nextSlide = PRESENTATION_SLIDES[clamped];
    soundEngine.playCameraWhoosh();
    if (nextSlide.metrics.some((m) => m.critical)) {
      window.setTimeout(() => soundEngine.playAlertPulse(), 180);
    }
    onSelectSlide(clamped);
  }

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

  function enterBriefing(withAudio: boolean) {
    if (withAudio && !soundEngine.isEnabled()) {
      setSoundOn(soundEngine.setEnabled(true));
    } else {
      soundEngine.playCameraWhoosh();
    }
    setIntroOpen(false);
  }

  // Keyboard navigation (Arrow keys / Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
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
          e.preventDefault();
          enterBriefing(false);
        }
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        if (slideIndex >= PRESENTATION_SLIDES.length - 1) {
          onOpenConsole();
        } else {
          goToSlide(slideIndex + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToSlide(slideIndex - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Wheel navigation with smooth cooldown
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (introOpen) return;
    if (Math.abs(e.deltaY) < 28) return;
    const now = performance.now();
    if (now - lastWheelAtRef.current < 580) return;
    lastWheelAtRef.current = now;

    if (e.deltaY > 0) {
      goToSlide(slideIndex + 1);
    } else {
      goToSlide(slideIndex - 1);
    }
  }

  return (
    <div
      onWheel={handleWheel}
      className="relative h-screen w-screen overflow-hidden bg-[#06070a] text-white select-none"
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
          autoRotate={slide.autoRotate}
          cameraResetToken={cameraResetToken}
          cameraPreset={introOpen ? "full" : slide.cameraPreset}
          enableParallax={true}
          allowWheelZoom={false}
          hideBottomHud={true}
          calloutFilter={slideIndex === 0 ? "none" : "selected"}
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

      {/* Top Architectural Frame Bar (28px unified HUD margin) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-7 sm:py-7">
        {/* Brand */}
        <button
          type="button"
          onClick={() => {
            setCameraResetToken((n) => n + 1);
            goToSlide(0);
          }}
          className="pointer-events-auto flex items-center gap-2.5 text-left transition opacity-90 hover:opacity-100"
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

        {/* Top-Right Single Console Action (Matched to CTA Glassmorphism) */}
        <div className="pointer-events-auto flex items-center">
          <button
            type="button"
            onClick={() => {
              soundEngine.playHoverTick();
              onOpenConsole();
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 font-mono text-[10px] font-semibold tracking-[0.18em] text-white backdrop-blur-md transition hover:border-white hover:bg-white hover:text-[#06070a]"
          >
            <span>CMO CONSOLE</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Left Compact HUD: Earth vs. Spaceflight Metrics (hidden on Slide 01 cover, clean glass cards on 02-06) */}
      {slideIndex > 0 && (
        <aside
          aria-label="Slide Telemetry Comparison"
          className="pointer-events-auto absolute top-1/2 left-5 z-30 hidden w-[268px] -translate-y-1/2 flex-col gap-2.5 sm:left-7 lg:flex"
        >
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-[0.18em] text-white/45">
            <span>EARTH VS SPACE</span>
            <span className="text-white/35">{slide.osdrRefs[0] ?? "NASA HRP"}</span>
          </div>

          {slide.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-white/12 bg-[#060a12]/48 p-3.5 backdrop-blur-md"
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
      )}

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
              onClick={() => goToSlide(idx)}
              onMouseEnter={() => soundEngine.playHoverTick()}
              aria-current={isActive ? "step" : undefined}
              className="group flex cursor-pointer items-center justify-end gap-3 text-right transition"
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
      <section className="pointer-events-none absolute inset-x-0 bottom-14 z-30 mx-auto flex max-w-2xl flex-col items-center px-5 text-center sm:bottom-12">
        <span className="font-mono text-[10px] tracking-[0.24em] text-sky-300/90">
          {slide.kicker}
        </span>

        <h1 className="mt-2.5 text-2xl font-semibold tracking-[0.06em] text-white text-balance sm:text-4xl lg:text-[42px] lg:leading-[1.08]">
          {scrambledTitle}
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
          {slide.chapterCode} / 06
        </span>
      </div>

      {/* Intro Portal Gate (Active Theory Style) */}
      {introOpen && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#06070a]/75 px-6 text-center backdrop-blur-md transition-opacity duration-500">
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
              <span>ENTER WITH AUDIO</span>
            </button>
            <button
              type="button"
              onClick={() => enterBriefing(false)}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-white/85 transition hover:border-white/40 hover:text-white"
            >
              <span>SILENT MODE</span>
            </button>
            <Link
              href="/orbital"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-sky-400/35 bg-sky-400/10 px-5 font-mono text-[11px] font-medium tracking-[0.18em] text-sky-200 transition hover:border-sky-300 hover:bg-sky-400/20 hover:text-white"
            >
              <span>EARTH → ISS 3D</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

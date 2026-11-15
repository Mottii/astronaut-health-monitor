"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { BioTwin3DStage, type FocusProjection } from "@/components/BioTwin3DStage";
import { DeveloperCards } from "@/components/DeveloperCards";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";
import { PRESENTATION_ACCENTS } from "@/data/presentationTheme";
import { followScroll, rebaseStoryProgress, STORY_CHAPTER_COUNT, storyScrollTarget, unwrapStoryProgress, wrapStoryProgress } from "@/lib/briefingPath";
import { soundEngine } from "@/lib/soundEngine";
import { startConsoleTransition } from "@/lib/consoleTransition";
import type { SpaceWeatherStatus } from "@/lib/nasaApi";
import type { BodySystemId, EnvironmentTelemetry, HealthEvaluationResult, VitalReadings } from "@/types/health";

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

const EDITORIAL_CHAPTERS = [
  { title: ["ARES-MED"], label: "AUTONOMOUS MEDICINE / DEEP SPACE", organ: "HUMAN BIOTWIN" },
  { title: ["A human life.", "Beyond Earth."], label: "MEDICINE FOR DEEP SPACE", organ: "HUMAN BIOTWIN" },
  { title: ["When fluid shifts,", "vision changes."], label: "NEURO-OCULAR / SANS", organ: "NEURO-OCULAR SYSTEM" },
  { title: ["A different gravity.", "A different rhythm."], label: "CARDIOVASCULAR ADAPTATION", organ: "HEART & CIRCULATION" },
  { title: ["Connected systems.", "Shared consequences."], label: "BONE & RENAL CASCADE", organ: "KIDNEYS & SKELETON" },
  { title: ["Invisible exposure.", "Visible response."], label: "RADIATION & IMMUNITY", organ: "IMMUNE SYSTEM" },
  { title: ["Rest. Rhythm.", "Balance."], label: "METABOLIC & CIRCADIAN", organ: "METABOLIC SYSTEM" },
].map((chapter,index) => ({ ...chapter, color: PRESENTATION_ACCENTS[index] }));

// Three identical runs leave room for native momentum on either side of the active run.
const CONSOLE_EXIT_MS = 640; // keep in sync with the ares-story-compress animation in globals.css
const STORY_PAGES = Array.from({ length: STORY_CHAPTER_COUNT * 3 }, (_, page) => {
  const index = page % STORY_CHAPTER_COUNT;
  return { index, page, slide: PRESENTATION_SLIDES[index], clone: page < STORY_CHAPTER_COUNT || page >= STORY_CHAPTER_COUNT * 2 };
});

export function PresentationStory({
  slideIndex, onSelectSlide, onOpenConsole, evaluation, vitals, envTelemetry,
  selectedSystem, onSelectSystem,
}: PresentationViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<Array<HTMLElement | null>>([]);
  const progressRef = useRef(slideIndex);
  const destinationRef = useRef(slideIndex);
  const physicalProgressRef = useRef(slideIndex);
  const modelRotationRef = useRef(0);
  const dragRef = useRef<{ pointer: number; x: number; y: number; angle: number; active: boolean } | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const initialIndex = useRef(slideIndex);
  const currentIndexRef = useRef(slideIndex);
  const onSelectRef = useRef(onSelectSlide);
  onSelectRef.current = onSelectSlide;
  const [soundEnabled, setSoundEnabled] = useState(() => soundEngine.isEnabled());
  const [soundPlaying, setSoundPlaying] = useState(() => soundEngine.isPlaying());
  // Background music starts on entry; if the browser blocks it, the engine resumes on the first gesture.
  useEffect(() => {
    const updateSound = () => {
      setSoundEnabled(soundEngine.isEnabled());
      setSoundPlaying(soundEngine.isPlaying());
    };
    const unsubscribe = soundEngine.subscribe(updateSound);
    soundEngine.enterPresentation();
    updateSound();
    return () => {
      unsubscribe();
      soundEngine.leavePresentation();
    };
  }, []);
  // Full motion is the requested presentation; a quiet, persistent opt-out remains available.
  const [reducedMotion, setReducedMotion] = useState(false);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const organLabelRef = useRef<HTMLDivElement>(null);
  const organLeaderRef = useRef<SVGPathElement>(null);
  const organAnchorRef = useRef<SVGCircleElement>(null);
  const projection = useCallback((point: FocusProjection) => {
    const label = organLabelRef.current;
    if (!label) return;
    const labelWidth = point.width < 1024 ? 180 : 200;
    const x = Math.max(point.width * 0.44, Math.min(point.width - labelWidth - 72, point.x + 110));
    // Keep the label above the anatomical anchor, leaving the organ itself unobstructed.
    const y = Math.max(94, Math.min(point.height - 130, point.y - 116));
    const visibility = point.visible && point.width > 760 ? "visible" : "hidden";
    label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    label.style.visibility = visibility;
    if (organLeaderRef.current) {
      const endY = y + 20;
      const bendX = Math.max(point.x + 22, x - 24);
      organLeaderRef.current.setAttribute("d", `M ${point.x.toFixed(1)} ${point.y.toFixed(1)} L ${bendX.toFixed(1)} ${endY.toFixed(1)} L ${x.toFixed(1)} ${endY.toFixed(1)}`);
      organLeaderRef.current.style.visibility = visibility;
    }
    if (organAnchorRef.current) {
      organAnchorRef.current.setAttribute("cx", String(point.x));
      organAnchorRef.current.setAttribute("cy", String(point.y));
      organAnchorRef.current.style.visibility = visibility;
    }
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = (initialIndex.current + STORY_CHAPTER_COUNT) * scroller.clientHeight;
    let raf = 0;
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const progress = reducedMotionRef.current
        ? destinationRef.current
        : followScroll(progressRef.current, destinationRef.current, dt);
      progressRef.current = progress;
      rootRef.current?.style.setProperty("--story-progress", String(wrapStoryProgress(progress) / STORY_CHAPTER_COUNT));
      const nearest = wrapStoryProgress(Math.round(progress));
      if (nearest !== currentIndexRef.current) {
        currentIndexRef.current = nearest;
        onSelectRef.current(nearest);
      }
      for (let i = 0; i < chaptersRef.current.length; i++) {
        const presence = Math.max(0, 1 - Math.abs(physicalProgressRef.current - (i - STORY_CHAPTER_COUNT)) * 0.95);
        chaptersRef.current[i]?.style.setProperty("--presence", String(presence));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    const onResize = () => {
      destinationRef.current = Math.round(progressRef.current);
      progressRef.current = destinationRef.current;
      physicalProgressRef.current = wrapStoryProgress(destinationRef.current);
      scroller.scrollTop = (physicalProgressRef.current + STORY_CHAPTER_COUNT) * scroller.clientHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const handleStoryScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const height = Math.max(1, scroller.clientHeight);
    const position = rebaseStoryProgress(scroller.scrollTop / height - STORY_CHAPTER_COUNT);
    destinationRef.current = unwrapStoryProgress(destinationRef.current, position.progress);
    physicalProgressRef.current = position.progress;
    if (position.shift !== 0) {
      // Only the DOM wraps. Camera, morph and particles keep their continuous timeline.
      scroller.scrollTo({ top: (position.progress + STORY_CHAPTER_COUNT) * height, behavior: "instant" });
    }
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => {
      const chapter = Math.round(physicalProgressRef.current);
      const centeredTop = (chapter + STORY_CHAPTER_COUNT) * scroller.clientHeight;
      if (Math.abs(scroller.scrollTop - centeredTop) > 1) {
        scroller.scrollTo({ top: centeredTop, behavior: reducedMotionRef.current ? "instant" : "smooth" });
      }
    }, 160);
  };

  const beginRotation = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, .ares-story-copy, .ares-title-brief")) return;
    dragRef.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, angle: modelRotationRef.current, active: false };
  };
  const rotateModel = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      drag.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      rootRef.current?.setAttribute("data-dragging", "true");
    }
    if (drag.active) {
      event.preventDefault();
      modelRotationRef.current = drag.angle + dx * 0.008;
    }
  };
  const endRotation = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointer !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    rootRef.current?.removeAttribute("data-dragging");
  };

  const goTo = useCallback((index: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    // A destination can already show slide 01 while its camera is still finishing slide 07.
    // Recenter that identical copy before navigation, so 01 -> 02 never traverses 07 -> 02.
    const physical = physicalProgressRef.current;
    const centered = physical - Math.floor((physical + 0.5) / STORY_CHAPTER_COUNT) * STORY_CHAPTER_COUNT;
    if (Math.abs(centered - physical) > 0.001) {
      physicalProgressRef.current = centered;
      scroller.scrollTo({ top: (centered + STORY_CHAPTER_COUNT) * scroller.clientHeight, behavior: "instant" });
    }
    const current = wrapStoryProgress(Math.round(centered));
    scroller.scrollTo({
      top: (storyScrollTarget(current, index) + STORY_CHAPTER_COUNT) * scroller.clientHeight,
      behavior: reducedMotionRef.current ? "instant" : "smooth",
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      if (event.key === "[" || event.key === "]") {
        event.preventDefault(); modelRotationRef.current += event.key === "[" ? -0.18 : 0.18;
      } else if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault(); goTo(wrapStoryProgress(Math.round(physicalProgressRef.current)) + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault(); goTo(wrapStoryProgress(Math.round(physicalProgressRef.current)) - 1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault(); goTo(event.key === "Home" ? 0 : STORY_CHAPTER_COUNT - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  // Opening the console: the briefing compresses away, then the console's panels fly in from the sides.
  const [leaving, setLeaving] = useState(false);
  const consoleCallbackRef = useRef(onOpenConsole);
  consoleCallbackRef.current = onOpenConsole;
  const consoleTransitionRef = useRef<ReturnType<typeof startConsoleTransition> | null>(null);
  useEffect(() => () => { consoleTransitionRef.current?.cancel(); }, []);
  const openConsole = useCallback(() => {
    if (consoleTransitionRef.current) return;
    soundEngine.leavePresentation();
    setLeaving(true);
    consoleTransitionRef.current = startConsoleTransition(
      () => consoleCallbackRef.current(),
      () => soundEngine.playCameraWhoosh(),
      reducedMotionRef.current ? 0 : CONSOLE_EXIT_MS + 80,
    );
  }, []);

  const activeChapter = EDITORIAL_CHAPTERS[slideIndex] ?? EDITORIAL_CHAPTERS[0];
  return (
    <div ref={rootRef} className="ares-story" data-testid="cinematic-briefing" data-slide={PRESENTATION_SLIDES[slideIndex]?.id} data-motion={reducedMotion ? "reduced" : "full"} data-leaving={leaving || undefined} style={{ "--chapter-color": activeChapter.color } as React.CSSProperties}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget && event.animationName === "ares-story-compress") consoleTransitionRef.current?.finish(); }}>
      <div className="ares-story-scene">
        <BioTwin3DStage assessments={evaluation.systems} cascades={evaluation.activeCascades}
          selectedSystem={selectedSystem} onSelectSystem={onSelectSystem}
          vitals={vitals} envTelemetry={envTelemetry} cinematic storyProgress={progressRef}
          modelRotation={modelRotationRef}
          reducedMotionOverride={reducedMotion} autoRotate={false} cameraResetToken={0}
          cameraPreset={PRESENTATION_SLIDES[slideIndex]?.cameraPreset}
          visualMode={PRESENTATION_SLIDES[slideIndex]?.visualMode}
          inspectEnabled={false} allowWheelZoom={false} enableParallax={!reducedMotion}
          hideBottomHud calloutFilter="none" onFocusProjection={projection} />
      </div>
      <div className="ares-story-shade" aria-hidden="true" />
      <header className="ares-story-header">
        <a href="#title" onClick={(event) => { event.preventDefault(); goTo(0); }} className="ares-story-wordmark" aria-label="ARES-MED — back to title">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26L14.5 6H18.5L28 26H23.2L16.5 11.4L9.2 26H4Z" fill="currentColor"/><path d="M5 20.5C11.5 14 20.5 11 29 9.5" stroke="#06070a" strokeWidth="2.5"/></svg>
          ARES-MED
        </a>
        <span className="ares-story-edition">HUMAN HEALTH / BEYOND EARTH</span>
        <div className="ares-story-header-actions">
          <button type="button" className="ares-story-sound" data-sound-toggle title={soundPlaying ? "Mute music" : "Start music"}
            aria-label={soundPlaying ? "Mute music" : "Start music"} aria-pressed={soundEnabled} onClick={() => { soundEngine.toggle(); }}>
            <span className="ares-story-audio-mark" data-enabled={soundEnabled} data-playing={soundPlaying} aria-hidden="true"><i /><i /><i /><i /></span>
          </button>
          <button type="button" onClick={openConsole} className="ares-story-console" disabled={leaving} aria-busy={leaving} aria-label="Open CMO console">CMO CONSOLE <ArrowUpRight size={14} aria-hidden="true" /></button>
        </div>
      </header>

      <div ref={scrollRef} className="ares-story-scroll" tabIndex={0}
        aria-label="Mission briefing. Scroll to explore; drag horizontally to rotate the logo or body. Bracket keys also rotate."
        onScroll={handleStoryScroll} onPointerDown={beginRotation} onPointerMove={rotateModel}
        onPointerUp={endRotation} onPointerCancel={endRotation}>
        {STORY_PAGES.map(({ slide, index, page, clone }) => {
          const chapter = EDITORIAL_CHAPTERS[index];
          const Heading = index === 0 && !clone ? "h1" : "h2";
          return (
            <section key={`${slide.id}-${page}`} id={clone ? undefined : slide.id} ref={(el) => { chaptersRef.current[page] = el; }}
              aria-hidden={clone || undefined} inert={clone || undefined}
              className={`ares-story-chapter ${index <= 1 ? "is-cover" : ""} ${index === 0 ? "is-title" : ""}`} aria-label={`${slide.chapterCode} ${slide.chapterLabel}`} style={{ "--chapter-color": chapter.color } as React.CSSProperties}>
              <div className="ares-story-copy">
                {index !== 0 && <div className="ares-story-eyebrow"><span>{slide.chapterCode}</span><span className="ares-story-rule" />{chapter.label}</div>}
                {index === 0 && <div className="ares-title-kicker">AUTONOMOUS MEDICINE / DEEP SPACE</div>}
                <Heading>{chapter.title.map((line) => <span key={line}>{line}</span>)}</Heading>
                {index === 0 && <div className="ares-story-title-subtitle">Human health. Beyond Earth.</div>}
                <p className="ares-story-description">{slide.summary}</p>
                {index === 0 ? <>
                  <div className="ares-story-title-caption"><span>HUMAN DIGITAL TWIN</span><span>01 HUMAN / 06 SYSTEMS</span></div>
                  <DeveloperCards />
                </> : (
                  <div className="ares-story-readings">
                    {slide.metrics.map((metric) => (
                      <div key={metric.label} className="ares-story-reading">
                        <span className="ares-story-reading-name">{metric.label}</span>
                        <strong>{metric.spaceValue}</strong><span className="ares-story-unit">{metric.unit}</span>
                        <span className="ares-story-reference">Earth reference · {metric.earthValue}</span>
                      </div>
                    ))}
                  </div>
                )}
                {index === STORY_CHAPTER_COUNT - 1 && (
                  <button type="button" onClick={openConsole} className="ares-story-action" disabled={leaving} aria-busy={leaving} tabIndex={clone ? -1 : undefined}>
                    OPEN CMO CONSOLE <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                )}
                <div className="ares-story-source">{index === 0 ? "NASA SPACE APPS / PROJECT PRESENTATION" : index === 1 ? "NASA SPACE APPS / MISSION CONTEXT" : `DEMO CASE / ${slide.osdrRefs.join(" · ")}`}</div>
              </div>
            </section>
          );
        })}
      </div>

      <svg className="ares-story-leaders" aria-hidden="true">
        <path ref={organLeaderRef} /><circle ref={organAnchorRef} r="2.5" />
      </svg>
      <div ref={organLabelRef} className="ares-story-organ" aria-hidden="true"><span>{activeChapter.organ}</span></div>
      <nav className="ares-story-nav" aria-label="Presentation chapters">
        {PRESENTATION_SLIDES.map((slide, index) => (
          <button key={slide.id} type="button" aria-label={`${slide.chapterCode} ${slide.chapterLabel}`} aria-current={index === slideIndex ? "step" : undefined} onClick={() => goTo(index)}><span /><em>{slide.chapterLabel}</em></button>
        ))}
      </nav>
      <footer className="ares-story-footer">
        <div className="ares-story-settings">
          <button type="button" className="ares-motion-setting" aria-pressed={reducedMotion} onClick={() => setReducedMotion((value) => !value)}>{reducedMotion ? "FULL MOTION" : "REDUCE MOTION"}</button>
        </div>
        <div className="ares-story-scroll-cue" aria-hidden="true"><span>{slideIndex === STORY_CHAPTER_COUNT - 1 ? "KEEP SCROLLING · BACK TO THE BEGINNING" : slideIndex === 0 ? "SCROLL TO EXPLORE · DRAG TO ROTATE LOGO" : "SCROLL TO EXPLORE · DRAG TO ROTATE"}</span><ArrowDown size={13} /></div>
        <span className="ares-story-counter">{String(slideIndex + 1).padStart(2, "0")}<span> / 07</span></span>
      </footer>
    </div>
  );
}

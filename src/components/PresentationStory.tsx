"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { BioTwin3DStage, type FocusProjection } from "@/components/BioTwin3DStage";
import { AresLogo3D } from "@/components/AresLogo3D";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";
import { followScroll, STORY_CHAPTER_COUNT, storyScrollTarget, wrapStoryProgress } from "@/lib/briefingPath";
import { soundEngine } from "@/lib/soundEngine";
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
  { title: ["ARES-MED"], label: "AUTONOMOUS MEDICINE / DEEP SPACE", color: "#c1d0dc", organ: "HUMAN BIOTWIN" },
  { title: ["A human life.", "Beyond Earth."], label: "MEDICINE FOR DEEP SPACE", color: "#c1d0dc", organ: "HUMAN BIOTWIN" },
  { title: ["When fluid shifts,", "vision changes."], label: "NEURO-OCULAR / SANS", color: "#70b7b2", organ: "NEURO-OCULAR SYSTEM" },
  { title: ["A different gravity.", "A different rhythm."], label: "CARDIOVASCULAR ADAPTATION", color: "#c8797e", organ: "HEART & CIRCULATION" },
  { title: ["Connected systems.", "Shared consequences."], label: "BONE & RENAL CASCADE", color: "#81ae98", organ: "KIDNEYS & SKELETON" },
  { title: ["Invisible exposure.", "Visible response."], label: "RADIATION & IMMUNITY", color: "#a895c1", organ: "IMMUNE SYSTEM" },
  { title: ["Rest. Rhythm.", "Balance."], label: "METABOLIC & CIRCADIAN", color: "#c6927c", organ: "METABOLIC SYSTEM" },
];

// Matching end copies let the native scroller cross the seam before being rebased invisibly.
const CONSOLE_EXIT_MS = 640; // keep in sync with the ares-story-compress animation in globals.css
const STORY_PAGES = [STORY_CHAPTER_COUNT - 1, ...PRESENTATION_SLIDES.map((_, index) => index), 0]
  .map((index, page) => ({ index, page, slide: PRESENTATION_SLIDES[index], clone: page === 0 || page === STORY_CHAPTER_COUNT + 1 }));

export function PresentationStory({
  slideIndex, onSelectSlide, onOpenConsole, evaluation, vitals, envTelemetry,
  selectedSystem, onSelectSystem,
}: PresentationViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<Array<HTMLElement | null>>([]);
  const progressRef = useRef(slideIndex);
  const destinationRef = useRef(slideIndex);
  const modelRotationRef = useRef(0);
  const dragRef = useRef<{ pointer: number; x: number; y: number; angle: number; active: boolean } | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const settleUntilRef = useRef(0);
  const initialIndex = useRef(slideIndex);
  const currentIndexRef = useRef(slideIndex);
  const onSelectRef = useRef(onSelectSlide);
  onSelectRef.current = onSelectSlide;
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  // Background music starts on entry; if the browser blocks it, the engine resumes on the first gesture.
  useEffect(() => { setSoundOn(soundEngine.initAutoplay()); }, []);
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
    scroller.scrollTop = (initialIndex.current + 1) * scroller.clientHeight;
    let raf = 0;
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      let progress = reducedMotionRef.current
        ? destinationRef.current
        : followScroll(progressRef.current, destinationRef.current, dt);
      const forwardSeam = destinationRef.current >= STORY_CHAPTER_COUNT - 0.001 && Math.abs(progress - STORY_CHAPTER_COUNT) < 0.004;
      const backwardSeam = destinationRef.current <= -0.999 && Math.abs(progress + 1) < 0.004;
      if (forwardSeam || backwardSeam) {
        const shift = forwardSeam ? -STORY_CHAPTER_COUNT : STORY_CHAPTER_COUNT;
        progress += shift;
        destinationRef.current += shift;
        scroller.scrollTo({ top: (destinationRef.current + 1) * scroller.clientHeight, behavior: "instant" });
      }
      progressRef.current = progress;
      rootRef.current?.style.setProperty("--story-progress", String(wrapStoryProgress(progress) / STORY_CHAPTER_COUNT));
      const nearest = wrapStoryProgress(Math.round(progress));
      if (nearest !== currentIndexRef.current) {
        currentIndexRef.current = nearest;
        onSelectRef.current(nearest);
      }
      for (let i = 0; i < chaptersRef.current.length; i++) {
        const presence = Math.max(0, 1 - Math.abs(destinationRef.current - (i - 1)) * 0.95);
        chaptersRef.current[i]?.style.setProperty("--presence", String(presence));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    const onResize = () => {
      destinationRef.current = currentIndexRef.current;
      progressRef.current = currentIndexRef.current;
      scroller.scrollTop = (currentIndexRef.current + 1) * scroller.clientHeight;
    };
    window.addEventListener("resize", onResize);
    const holdAtChapter = (event: WheelEvent) => {
      if (performance.now() < settleUntilRef.current) event.preventDefault();
    };
    scroller.addEventListener("wheel", holdAtChapter, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
      scroller.removeEventListener("wheel", holdAtChapter);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const handleStoryScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    destinationRef.current = scroller.scrollTop / Math.max(1, scroller.clientHeight) - 1;
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => {
      const chapter = Math.round(destinationRef.current);
      const centeredTop = (chapter + 1) * scroller.clientHeight;
      if (Math.abs(scroller.scrollTop - centeredTop) > 1) {
        scroller.scrollTo({ top: centeredTop, behavior: reducedMotionRef.current ? "instant" : "smooth" });
      } else {
        // A brief reading pause catches leftover trackpad momentum, not the next deliberate gesture.
        settleUntilRef.current = performance.now() + 280;
      }
    }, 160);
  };

  const beginRotation = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, .ares-story-copy")) return;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    rootRef.current?.removeAttribute("data-dragging");
  };

  const goTo = useCallback((index: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      top: (storyScrollTarget(currentIndexRef.current, index) + 1) * scroller.clientHeight,
      behavior: reducedMotionRef.current ? "instant" : "smooth",
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, textarea, select, button, a, [contenteditable=true]")) return;
      if (event.key === "[" || event.key === "]") {
        event.preventDefault(); modelRotationRef.current += event.key === "[" ? -0.18 : 0.18;
      } else if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault(); goTo(currentIndexRef.current + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault(); goTo(currentIndexRef.current - 1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault(); goTo(event.key === "Home" ? 0 : STORY_CHAPTER_COUNT - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  // Opening the console: the briefing compresses away, then the console's panels fly in from the sides.
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current); }, []);
  const openConsole = useCallback(() => {
    if (leaveTimerRef.current !== null) return;
    setLeaving(true);
    soundEngine.playCameraWhoosh();
    leaveTimerRef.current = window.setTimeout(onOpenConsole, reducedMotionRef.current ? 0 : CONSOLE_EXIT_MS);
  }, [onOpenConsole]);

  const activeChapter = EDITORIAL_CHAPTERS[slideIndex] ?? EDITORIAL_CHAPTERS[0];
  return (
    <div ref={rootRef} className="ares-story" data-testid="cinematic-briefing" data-slide={PRESENTATION_SLIDES[slideIndex]?.id} data-motion={reducedMotion ? "reduced" : "full"} data-leaving={leaving || undefined} style={{ "--chapter-color": activeChapter.color } as React.CSSProperties}>
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
          <button type="button" className="ares-story-sound" title={soundOn ? "Mute ambient audio" : "Enable ambient audio"}
            aria-label={soundOn ? "Mute sound" : "Enable sound"} aria-pressed={soundOn} onClick={() => setSoundOn(soundEngine.toggle())}>
            <span className="ares-story-audio-mark" data-playing={soundOn} aria-hidden="true"><i /><i /><i /><i /></span>
          </button>
          <button type="button" onClick={openConsole} className="ares-story-console">CMO CONSOLE <ArrowUpRight size={14} aria-hidden="true" /></button>
        </div>
      </header>

      <div ref={scrollRef} className="ares-story-scroll" tabIndex={0}
        aria-label="Mission briefing. Scroll to explore; drag horizontally to rotate the body. Bracket keys also rotate."
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
                <Heading className={index === 0 ? "ares-sr-only" : undefined}>{chapter.title.map((line) => <span key={line}>{line}</span>)}</Heading>
                {index === 0 && <AresLogo3D className="ares-story-logo" reducedMotion={reducedMotion} />}
                <p className="ares-story-description">{slide.summary}</p>
                {index === 0 ? <div className="ares-story-title-caption"><span>HUMAN DIGITAL TWIN</span><span>01 HUMAN / 06 SYSTEMS</span></div> : (
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
                  <button type="button" onClick={openConsole} className="ares-story-action" tabIndex={clone ? -1 : undefined}>
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
        <div className="ares-story-scroll-cue" aria-hidden="true"><span>{slideIndex === STORY_CHAPTER_COUNT - 1 ? "SCROLL TO RETURN" : "SCROLL TO EXPLORE · DRAG TO ROTATE"}</span><ArrowDown size={13} /></div>
        <span className="ares-story-counter">{String(slideIndex + 1).padStart(2, "0")}<span> / 07</span></span>
      </footer>
    </div>
  );
}

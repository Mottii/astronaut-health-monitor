"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Volume2, VolumeX } from "lucide-react";
import { BioTwin3DStage, type FocusProjection } from "@/components/BioTwin3DStage";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";
import { followScroll } from "@/lib/briefingPath";
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
  { title: ["A human life.", "Beyond Earth."], label: "MEDICINE FOR DEEP SPACE", color: "#c1d0dc", organ: "HUMAN BIOTWIN" },
  { title: ["When fluid shifts,", "vision changes."], label: "NEURO-OCULAR / SANS", color: "#70b7b2", organ: "NEURO-OCULAR SYSTEM" },
  { title: ["A different gravity.", "A different rhythm."], label: "CARDIOVASCULAR ADAPTATION", color: "#c8797e", organ: "HEART & CIRCULATION" },
  { title: ["Connected systems.", "Shared consequences."], label: "BONE & RENAL CASCADE", color: "#81ae98", organ: "KIDNEYS & SKELETON" },
  { title: ["Invisible exposure.", "Visible response."], label: "RADIATION & IMMUNITY", color: "#a895c1", organ: "IMMUNE SYSTEM" },
  { title: ["Rest. Rhythm.", "Balance."], label: "METABOLIC & CIRCADIAN", color: "#c5a073", organ: "METABOLIC SYSTEM" },
  { title: ["From signals", "to action."], label: "AUTONOMOUS MEDICAL OFFICER", color: "#c1d0dc", organ: "DIAGNOSTIC OVERVIEW" },
];

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
  // Full motion is the requested presentation; a quiet, persistent opt-out remains available.
  const [reducedMotion, setReducedMotion] = useState(false);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const organLabelRef = useRef<HTMLDivElement>(null);
  const projection = useCallback((point: FocusProjection) => {
    const label = organLabelRef.current;
    if (!label) return;
    const x = Math.min(point.width - 175, point.x + 68);
    label.style.transform = `translate3d(${x}px, ${point.y - 8}px, 0)`;
    label.style.visibility = point.visible && point.width > 760 ? "visible" : "hidden";
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = initialIndex.current * scroller.clientHeight;
    let raf = 0;
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const progress = reducedMotionRef.current
        ? destinationRef.current
        : followScroll(progressRef.current, destinationRef.current, dt);
      progressRef.current = progress;
      rootRef.current?.style.setProperty("--story-progress", String(progress / 6));
      const nearest = Math.max(0, Math.min(6, Math.round(progress)));
      if (nearest !== currentIndexRef.current) {
        currentIndexRef.current = nearest;
        onSelectRef.current(nearest);
      }
      for (let i = 0; i < chaptersRef.current.length; i++) {
        const presence = Math.max(0, 1 - Math.abs(destinationRef.current - i) * 0.95);
        chaptersRef.current[i]?.style.setProperty("--presence", String(presence));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    const onResize = () => {
      destinationRef.current = currentIndexRef.current;
      scroller.scrollTop = currentIndexRef.current * scroller.clientHeight;
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
    destinationRef.current = scroller.scrollTop / Math.max(1, scroller.clientHeight);
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => {
      const chapter = Math.round(destinationRef.current);
      const centeredTop = chapter * scroller.clientHeight;
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
      top: Math.max(0, Math.min(6, index)) * scroller.clientHeight,
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
        event.preventDefault(); goTo(event.key === "Home" ? 0 : 6);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  const activeChapter = EDITORIAL_CHAPTERS[slideIndex] ?? EDITORIAL_CHAPTERS[0];
  return (
    <div ref={rootRef} className="ares-story" data-testid="cinematic-briefing" data-slide={PRESENTATION_SLIDES[slideIndex]?.id} data-motion={reducedMotion ? "reduced" : "full"} style={{ "--chapter-color": activeChapter.color } as React.CSSProperties}>
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
        <a href="#mission" onClick={(event) => { event.preventDefault(); goTo(0); }} className="ares-story-wordmark" aria-label="ARES-MED — back to mission">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26L14.5 6H18.5L28 26H23.2L16.5 11.4L9.2 26H4Z" fill="currentColor"/><path d="M5 20.5C11.5 14 20.5 11 29 9.5" stroke="#06070a" strokeWidth="2.5"/></svg>
          ARES-MED
        </a>
        <span className="ares-story-edition">HUMAN HEALTH / BEYOND EARTH</span>
        <button type="button" onClick={onOpenConsole} className="ares-story-console">CMO CONSOLE <ArrowUpRight size={14} aria-hidden="true" /></button>
      </header>

      <div ref={scrollRef} className="ares-story-scroll" tabIndex={0}
        aria-label="Mission briefing. Scroll to explore; drag horizontally to rotate the body. Bracket keys also rotate."
        onScroll={handleStoryScroll} onPointerDown={beginRotation} onPointerMove={rotateModel}
        onPointerUp={endRotation} onPointerCancel={endRotation}>
        {PRESENTATION_SLIDES.map((slide, index) => {
          const chapter = EDITORIAL_CHAPTERS[index];
          const Heading = index === 0 ? "h1" : "h2";
          return (
            <section key={slide.id} id={index === 0 ? "mission" : slide.id} ref={(el) => { chaptersRef.current[index] = el; }}
              className={`ares-story-chapter ${index === 0 ? "is-cover" : ""}`} aria-label={`${slide.chapterCode} ${slide.chapterLabel}`} style={{ "--chapter-color": chapter.color } as React.CSSProperties}>
              <div className="ares-story-copy">
                <div className="ares-story-eyebrow"><span>{slide.chapterCode}</span><span className="ares-story-rule" />{chapter.label}</div>
                <Heading>{chapter.title.map((line) => <span key={line}>{line}</span>)}</Heading>
                <p className="ares-story-description">{slide.summary}</p>
                {index === 6 ? (
                  <>
                    <div className="ares-story-result"><span className={`status-${evaluation.overallStatus}`} />
                      <span>{evaluation.overallStatus === "green" ? "NOMINAL" : evaluation.overallStatus === "amber" ? "CAUTION" : "CRITICAL"}</span>
                      <strong>{evaluation.readinessScore}<small> / 100</small></strong>
                    </div>
                    <button type="button" onClick={onOpenConsole} className="ares-story-action">Explore the CMO console <ArrowUpRight size={17} aria-hidden="true" /></button>
                  </>
                ) : (
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
                <div className="ares-story-source">{index === 0 ? "NASA SPACE APPS / MISSION CONTEXT" : index === 6 ? "CURRENT DEMO CASE / CMO HANDOFF" : `DEMO CASE / ${slide.osdrRefs.join(" · ")}`}</div>
              </div>
            </section>
          );
        })}
      </div>

      <div ref={organLabelRef} className="ares-story-organ" aria-hidden="true"><i /><span>{activeChapter.organ}</span></div>
      <nav className="ares-story-nav" aria-label="Presentation chapters">
        {PRESENTATION_SLIDES.map((slide, index) => (
          <button key={slide.id} type="button" aria-label={`${slide.chapterCode} ${slide.chapterLabel}`} aria-current={index === slideIndex ? "step" : undefined} onClick={() => goTo(index)}><span /><em>{slide.chapterLabel}</em></button>
        ))}
      </nav>
      <footer className="ares-story-footer">
        <div className="ares-story-settings">
          <button type="button" title={soundOn ? "Mute ambient audio" : "Enable ambient audio"} aria-label={soundOn ? "Mute sound" : "Enable sound"} aria-pressed={soundOn} onClick={() => setSoundOn(soundEngine.toggle())}>{soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}<span>SOUND {soundOn ? "ON" : "OFF"}</span></button>
          <button type="button" className="ares-motion-setting" aria-pressed={reducedMotion} onClick={() => setReducedMotion((value) => !value)}>{reducedMotion ? "FULL MOTION" : "REDUCE MOTION"}</button>
        </div>
        <div className="ares-story-scroll-cue" aria-hidden="true"><span>{slideIndex === 6 ? "DRAG TO ROTATE" : "SCROLL TO EXPLORE · DRAG TO ROTATE"}</span>{slideIndex < 6 && <ArrowDown size={13} />}</div>
        <span className="ares-story-counter">{String(slideIndex + 1).padStart(2, "0")}<span> / 07</span></span>
      </footer>
    </div>
  );
}

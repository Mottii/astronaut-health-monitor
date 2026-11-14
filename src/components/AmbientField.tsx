"use client";

import React, { useEffect, useRef } from "react";

/**
 * Quiet ambient layer for the briefing. Subtle, low-contrast deep-space elements
 * that add spatial depth without competing with the 3D subject or editorial text:
 *  - two large, ultra-faint orbital trajectory arcs with tiny gliding nodes
 *  - one slow radar ripple expanding from the focal area
 *  - a rare, faint meteor
 * Everything is tinted by the active chapter colour. Reduced motion draws a single still frame.
 */
interface AmbientFieldProps {
  reducedMotion?: boolean;
  className?: string;
}

function parseHex(value: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function AmbientField({ reducedMotion = false, className }: AmbientFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const host = canvas?.parentElement;
    if (!canvas || !ctx || !host) return;

    let w = 1;
    let h = 1;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, canvas.clientWidth);
      h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedRef.current) draw(0, 0);
    });
    resizeObserver.observe(canvas);

    let tint: [number, number, number] = [193, 208, 220];
    let tintTarget: [number, number, number] = tint;
    let frame = 0;
    let meteor: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextMeteorAt = 7;

    const rgba = (c: [number, number, number], a: number) =>
      `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

    function draw(t: number, dt: number) {
      const still = reducedRef.current;
      frame += 1;
      if (frame % 20 === 1) {
        tintTarget = parseHex(
          getComputedStyle(host as Element).getPropertyValue("--chapter-color"),
          tintTarget
        );
      }
      const k = still ? 1 : Math.min(1, dt * 1.6);
      tint = [
        tint[0] + (tintTarget[0] - tint[0]) * k,
        tint[1] + (tintTarget[1] - tint[1]) * k,
        tint[2] + (tintTarget[2] - tint[2]) * k,
      ];
      const progress =
        parseFloat((host as HTMLElement).style.getPropertyValue("--story-progress")) || 0;
      void progress;

      ctx!.clearRect(0, 0, w, h);

      // 1. Two ultra-faint orbital trajectory arcs with tiny gliding orbital nodes
      const arcs = [
        {
          cx: w * 0.88,
          cy: h * 0.16,
          rx: Math.min(w, h) * 0.52,
          ry: Math.min(w, h) * 0.24,
          rot: -0.28,
          start: Math.PI * 0.65,
          end: Math.PI * 1.42,
          speed: 0.045,
          phase: 0.2,
        },
        {
          cx: w * 0.18,
          cy: h * 0.92,
          rx: Math.min(w, h) * 0.62,
          ry: Math.min(w, h) * 0.28,
          rot: -0.14,
          start: Math.PI * 1.15,
          end: Math.PI * 1.92,
          speed: 0.032,
          phase: 0.65,
        },
      ];

      ctx!.lineWidth = 1;
      for (const arc of arcs) {
        ctx!.strokeStyle = rgba(tint, 0.045);
        ctx!.beginPath();
        ctx!.ellipse(arc.cx, arc.cy, arc.rx, arc.ry, arc.rot, arc.start, arc.end);
        ctx!.stroke();
      }

      // 2. A rare, faint meteor
      if (!still) {
        if (!meteor && t > nextMeteorAt) {
          meteor = {
            x: w * (0.45 + Math.random() * 0.5),
            y: h * (0.04 + Math.random() * 0.25),
            vx: -w * 0.5,
            vy: h * 0.2,
            life: 0,
          };
          nextMeteorAt = t + 9 + Math.random() * 9;
        }
        if (meteor) {
          meteor.life += dt;
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          const alpha = Math.sin(Math.PI * Math.min(1, meteor.life / 1.1)) * 0.34;
          const tail = 90;
          const len = Math.hypot(meteor.vx, meteor.vy);
          const g = ctx!.createLinearGradient(
            meteor.x,
            meteor.y,
            meteor.x - (meteor.vx / len) * tail,
            meteor.y - (meteor.vy / len) * tail
          );
          g.addColorStop(0, rgba([235, 241, 246], alpha));
          g.addColorStop(1, rgba(tint, 0));
          ctx!.strokeStyle = g;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath();
          ctx!.moveTo(meteor.x, meteor.y);
          ctx!.lineTo(meteor.x - (meteor.vx / len) * tail, meteor.y - (meteor.vy / len) * tail);
          ctx!.stroke();
          if (meteor.life > 1.1) meteor = null;
        }
      }
    }

    if (reducedRef.current) draw(0, 0);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      if (reducedRef.current) return;
      draw(now / 1000, dt);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

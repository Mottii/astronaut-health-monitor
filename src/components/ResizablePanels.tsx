"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { clampPanelSize, panelResizeBounds } from "@/lib/panelResize";

interface ResizablePanelsProps {
  children: [React.ReactNode, React.ReactNode];
  label: string;
  defaultSize: string;
  minPrimary: number;
  minSecondary: number;
  maxPrimary?: number;
  className?: string;
}

/** Desktop split view; smaller screens retain the ordinary stacked layout. */
export function ResizablePanels({ children, label, defaultSize, minPrimary, minSecondary, maxPrimary, className = "" }: ResizablePanelsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointer: number; x: number; size: number } | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [measuredSize, setMeasuredSize] = useState(0);
  const [dragging, setDragging] = useState(false);
  const id = useId();
  const bounds = panelResizeBounds(width, minPrimary, minSecondary, maxPrimary);

  useEffect(() => {
    const root = rootRef.current;
    const primary = primaryRef.current;
    if (!root || !primary) return;
    const observer = new ResizeObserver(() => {
      const nextWidth = root.clientWidth;
      setWidth(nextWidth);
      setMeasuredSize(primary.getBoundingClientRect().width);
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setSize((previous) => previous === null ? null : clampPanelSize(previous, nextWidth, minPrimary, minSecondary, maxPrimary));
      }
    });
    observer.observe(root);
    observer.observe(primary);
    return () => observer.disconnect();
  }, [minPrimary, minSecondary, maxPrimary]);

  const resizeTo = (next: number) => {
    if (!rootRef.current) return;
    setSize(clampPanelSize(next, rootRef.current.clientWidth, minPrimary, minSecondary, maxPrimary));
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointer !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div ref={rootRef} className={`ares-split ${className}`} data-resizing={dragging || undefined}
      style={{ "--panel-size": size === null ? defaultSize : `${size}px`, "--panel-min": `${bounds.min}px`, "--panel-max": width ? `${bounds.max}px` : `calc(100% - ${minSecondary + 10}px)` } as React.CSSProperties}>
      <div id={`${id}-primary`} ref={primaryRef} className="ares-split-panel">{children[0]}</div>
      <div role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical"
        aria-controls={`${id}-primary ${id}-secondary`} aria-valuemin={Math.round(bounds.min)} aria-valuemax={Math.round(bounds.max)}
        aria-valuenow={Math.round(Math.max(bounds.min, Math.min(bounds.max, measuredSize)))}
        aria-valuetext={`${Math.round(measuredSize)} pixels`} title={`${label} · Drag to resize · Double-click to reset`}
        className="ares-split-handle"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          dragRef.current = { pointer: event.pointerId, x: event.clientX, size: primaryRef.current?.getBoundingClientRect().width ?? 0 };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointer !== event.pointerId) return;
          event.preventDefault();
          resizeTo(drag.size + event.clientX - drag.x);
        }}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
        onDoubleClick={() => setSize(null)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const current = primaryRef.current?.getBoundingClientRect().width ?? 0;
          const step = event.shiftKey ? 40 : 10;
          resizeTo(event.key === "Home" ? bounds.min : event.key === "End" ? bounds.max : current + (event.key === "ArrowLeft" ? -step : step));
        }}><span aria-hidden="true" /></div>
      <div id={`${id}-secondary`} className="ares-split-panel">{children[1]}</div>
    </div>
  );
}

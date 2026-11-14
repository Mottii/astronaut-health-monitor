"use client";

import React from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Radio } from "lucide-react";
import { BODY_SYSTEM_METADATA } from "@/data/nasaHrpData";
import type {
  BodySystemId,
  CascadeLink,
  SystemAssessment,
  TriageStatus,
} from "@/types/health";

export interface BioTwinBodyMapProps {
  assessments: Record<BodySystemId, SystemAssessment>;
  cascades: CascadeLink[];
  selectedSystem: BodySystemId;
  onSelectSystem: (systemId: BodySystemId) => void;
}

const SYSTEM_ORDER: BodySystemId[] = [
  "neuro_ocular",
  "behavioral_circadian",
  "cardiovascular",
  "immune_hematology",
  "metabolic_endocrine",
  "musculoskeletal_renal",
];

const STATUS_STYLE: Record<
  TriageStatus,
  {
    fill: string;
    stroke: string;
    badgeBg: string;
    badgeText: string;
    label: string;
  }
> = {
  green: {
    fill: "#10b981",
    stroke: "#34d399",
    badgeBg: "bg-emerald-500/15 border-emerald-500/40",
    badgeText: "text-emerald-300",
    label: "NOMINAL",
  },
  amber: {
    fill: "#f59e0b",
    stroke: "#fbbf24",
    badgeBg: "bg-amber-500/15 border-amber-500/40",
    badgeText: "text-amber-300",
    label: "CAUTION",
  },
  red: {
    fill: "#ef4444",
    stroke: "#f87171",
    badgeBg: "bg-rose-500/15 border-rose-500/40",
    badgeText: "text-rose-300",
    label: "ALERT",
  },
};

function buildCascadeCurvePath(
  fromId: BodySystemId,
  toId: BodySystemId,
  index: number
): string {
  const from = BODY_SYSTEM_METADATA[fromId].svgCoords;
  const to = BODY_SYSTEM_METADATA[toId].svgCoords;
  const midX = (from.cx + to.cx) / 2;
  const midY = (from.cy + to.cy) / 2;
  const curveOffset = index % 2 === 0 ? -36 : 36;
  const ctrlX = midX + curveOffset;
  const ctrlY = midY - 10;
  return `M ${from.cx} ${from.cy} Q ${ctrlX} ${ctrlY} ${to.cx} ${to.cy}`;
}

export function BioTwinBodyMap({
  assessments,
  cascades,
  selectedSystem,
  onSelectSystem,
}: BioTwinBodyMapProps) {
  return (
    <section
      aria-label="BioTwin Anatomical Body Map"
      className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            BioTwin Anatomy Map
          </p>
          <h2 className="text-sm font-semibold text-slate-100">
            Click Body Region for Spaceflight Triage
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-medium">
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            OK
          </span>
          <span className="flex items-center gap-1 text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Caution
          </span>
          <span className="flex items-center gap-1 text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Alert
          </span>
        </div>
      </div>

      {/* Interactive Anatomical SVG */}
      <div className="relative flex justify-center rounded-lg border border-slate-800/80 bg-slate-950/90 p-2">
        <svg
          viewBox="0 0 280 320"
          className="h-[310px] w-full max-w-[280px]"
          role="img"
          aria-label="Interactive astronaut anatomical telemetry diagram"
        >
          <defs>
            <pattern
              id="telemetry-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1"
              />
            </pattern>
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
            </marker>
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f87171" />
            </marker>
          </defs>

          <rect width="280" height="320" fill="url(#telemetry-grid)" />

          {/* Anatomical Human Silhouette */}
          <g
            fill="#0f172a"
            stroke="#334155"
            strokeWidth="1.6"
            strokeLinejoin="round"
          >
            {/* Head */}
            <circle cx="140" cy="48" r="23" />
            {/* Neck */}
            <path d="M 131 70 L 131 84 L 149 84 L 149 70" />
            {/* Torso & Shoulders */}
            <path d="M 131 84 L 94 90 Q 78 93 74 112 L 58 184 Q 56 193 65 194 Q 73 194 77 185 L 94 124 L 99 194 L 104 298 Q 105 307 116 307 Q 126 307 127 298 L 136 218 L 144 218 L 153 298 Q 154 307 164 307 Q 175 307 176 298 L 181 194 L 186 124 L 203 185 Q 207 194 215 194 Q 224 193 222 184 L 206 112 Q 202 93 186 90 L 149 84 Z" />
          </g>

          {/* Subtle Internal Organ Reference Outlines */}
          <g fill="none" stroke="#1e293b" strokeWidth="1.2">
            <ellipse cx="140" cy="46" rx="14" ry="12" />
            <path d="M 140 84 L 140 198" strokeDasharray="3 3" />
            <ellipse cx="148" cy="118" rx="13" ry="11" />
            <ellipse cx="124" cy="172" rx="9" ry="12" />
            <ellipse cx="156" cy="172" rx="9" ry="12" />
          </g>

          {/* Active Domino Cascade Bezier Connectors */}
          {cascades.map((cascade, index) => {
            const pathD = buildCascadeCurvePath(
              cascade.fromSystem,
              cascade.toSystem,
              index
            );
            const isRed = cascade.severity === "red";
            return (
              <g key={cascade.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isRed ? "#f87171" : "#fbbf24"}
                  strokeWidth="2.4"
                  strokeDasharray="5 4"
                  markerEnd={isRed ? "url(#arrow-red)" : "url(#arrow-amber)"}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="18"
                    to="0"
                    dur="1.1s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            );
          })}

          {/* 6 Clickable Organ Nodes */}
          {SYSTEM_ORDER.map((systemId) => {
            const meta = BODY_SYSTEM_METADATA[systemId];
            const assessment = assessments[systemId];
            const style = STATUS_STYLE[assessment.status];
            const isSelected = selectedSystem === systemId;
            const { cx, cy } = meta.svgCoords;

            return (
              <g
                key={systemId}
                role="button"
                tabIndex={0}
                aria-label={`${meta.name}: ${style.label}`}
                aria-pressed={isSelected}
                onClick={() => onSelectSystem(systemId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSystem(systemId);
                  }
                }}
                className="cursor-pointer focus:outline-none"
              >
                {assessment.status === "red" && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="16"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    opacity="0.7"
                  >
                    <animate
                      attributeName="r"
                      values="11;21;11"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0.1;0.8"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="14"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2.5"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r="9"
                  fill={style.fill}
                  stroke="#020617"
                  strokeWidth="2"
                />

                {/* Label pill offset left/right cleanly */}
                <title>{`${meta.name} — ${assessment.headline}`}</title>
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-900/85 px-2 py-0.5 text-[10px] text-slate-400">
          {cascades.length > 0
            ? `${cascades.length} active organ cascade${
                cascades.length > 1 ? "s" : ""
              }`
            : "0 active cascades"}
        </div>
      </div>

      {/* Keyboard-Accessible Synchronized Organ Selector Grid */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {SYSTEM_ORDER.map((systemId) => {
          const meta = BODY_SYSTEM_METADATA[systemId];
          const assessment = assessments[systemId];
          const style = STATUS_STYLE[assessment.status];
          const isSelected = selectedSystem === systemId;

          return (
            <button
              key={systemId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectSystem(systemId)}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition ${
                isSelected
                  ? "border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400/50"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
              }`}
            >
              <span className="truncate text-xs font-medium text-slate-200">
                {meta.shortLabel}
              </span>
              <span
                className={`ml-1.5 rounded border px-1.5 py-0.5 text-[10px] font-bold ${style.badgeBg} ${style.badgeText}`}
              >
                {assessment.score}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Multi-Organ Cascade Callouts */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Radio className="h-3.5 w-3.5 text-cyan-400" />
          <span>Domino Cascade Monitor</span>
        </div>

        {cascades.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>No cross-organ hazard cascades triggered.</span>
          </div>
        ) : (
          cascades.map((cascade) => {
            const isRed = cascade.severity === "red";
            return (
              <button
                key={cascade.id}
                type="button"
                onClick={() => onSelectSystem(cascade.toSystem)}
                className={`w-full rounded-lg border p-2.5 text-left transition ${
                  isRed
                    ? "border-rose-500/40 bg-rose-950/30 hover:border-rose-400"
                    : "border-amber-500/40 bg-amber-950/30 hover:border-amber-400"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      isRed ? "text-rose-300" : "text-amber-300"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {cascade.title}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-300">
                  {cascade.immediateAction}
                </p>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

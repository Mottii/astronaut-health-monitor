"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Layers,
  RotateCcw,
} from "lucide-react";
import {
  BioTwin3DStage,
  type ClinicalVisualMode,
} from "@/components/BioTwin3DStage";
import { BODY_SYSTEM_METADATA } from "@/data/nasaHrpData";
import type {
  BodySystemId,
  CascadeLink,
  EnvironmentTelemetry,
  SelectedSubStructure,
  SystemAssessment,
  TelemetryMode,
  TriageStatus,
  VitalReadings,
} from "@/types/health";

export interface BioTwinBodyMapProps {
  assessments: Record<BodySystemId, SystemAssessment>;
  cascades: CascadeLink[];
  selectedSystem: BodySystemId;
  onSelectSystem: (systemId: BodySystemId) => void;
  onSelectSubStructure?: (info: SelectedSubStructure) => void;
  vitals?: VitalReadings;
  envTelemetry?: EnvironmentTelemetry;
  telemetryMode?: TelemetryMode;
  hardwareSourceLabel?: string;
}

const SYSTEM_ORDER: BodySystemId[] = [
  "neuro_ocular",
  "behavioral_circadian",
  "cardiovascular",
  "immune_hematology",
  "metabolic_endocrine",
  "musculoskeletal_renal",
];

const SYSTEM_AVATAR_COLOR: Record<
  BodySystemId,
  { hex: string; shapeClass: string; tilt: string }
> = {
  neuro_ocular: { hex: "#2dd4bf", shapeClass: "rounded-full", tilt: "-rotate-6" },
  behavioral_circadian: { hex: "#818cf8", shapeClass: "rounded-[14px]", tilt: "rotate-6" },
  cardiovascular: { hex: "#fb7185", shapeClass: "rounded-full", tilt: "-rotate-3" },
  immune_hematology: { hex: "#c084fc", shapeClass: "rounded-[14px]", tilt: "rotate-3" },
  metabolic_endocrine: { hex: "#f97316", shapeClass: "rounded-full", tilt: "-rotate-6" },
  musculoskeletal_renal: { hex: "#4ade80", shapeClass: "rounded-[14px]", tilt: "rotate-3" },
};

const STATUS_STYLE: Record<
  TriageStatus,
  {
    color: string;
    dotClass: string;
    pillClass: string;
    label: string;
  }
> = {
  green: {
    color: "#34d399",
    dotClass: "bg-emerald-400",
    pillClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    label: "NOMINAL",
  },
  amber: {
    color: "#fbbf24",
    dotClass: "bg-amber-400",
    pillClass: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    label: "CAUTION",
  },
  red: {
    color: "#f87171",
    dotClass: "bg-rose-400",
    pillClass: "border-rose-500/30 bg-rose-500/15 text-rose-300",
    label: "ALERT",
  },
};

interface BlueprintNodeConfig {
  cx: number;
  cy: number;
  side: "left" | "right";
  labelY: number;
}

const BLUEPRINT_NODES: Record<BodySystemId, BlueprintNodeConfig> = {
  behavioral_circadian: { cx: 200, cy: 46, side: "left", labelY: 36 },
  neuro_ocular: { cx: 220, cy: 58, side: "right", labelY: 48 },
  immune_hematology: { cx: 208, cy: 128, side: "left", labelY: 118 },
  cardiovascular: { cx: 221, cy: 154, side: "right", labelY: 146 },
  metabolic_endocrine: { cx: 191, cy: 188, side: "left", labelY: 182 },
  musculoskeletal_renal: { cx: 227, cy: 214, side: "right", labelY: 208 },
};

function buildCascadeCurvePath(
  fromId: BodySystemId,
  toId: BodySystemId,
  index: number
): string {
  const from = BLUEPRINT_NODES[fromId];
  const to = BLUEPRINT_NODES[toId];
  const midX = (from.cx + to.cx) / 2;
  const midY = (from.cy + to.cy) / 2;
  const curveOffset = index % 2 === 0 ? -46 : 46;
  const ctrlX = midX + curveOffset;
  const ctrlY = midY - 12;
  return `M ${from.cx} ${from.cy} Q ${ctrlX} ${ctrlY} ${to.cx} ${to.cy}`;
}

function BotMarkAvatar({
  color,
  shapeClass,
  tilt,
  size = "md",
}: {
  color: string;
  shapeClass: string;
  tilt?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const eyeW = size === "sm" ? "w-[2.5px] h-[6px]" : "w-[3.5px] h-[9px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${dim} ${shapeClass} shadow-inner`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <span className={`flex items-center gap-[3px] ${tilt ?? ""}`}>
        <span className={`${eyeW} rounded-full bg-[#0a0a0a]`} />
        <span className={`${eyeW} rounded-full bg-[#0a0a0a]`} />
      </span>
    </span>
  );
}

export function BioTwinBodyMap({
  assessments,
  cascades,
  selectedSystem,
  onSelectSystem,
  onSelectSubStructure,
  vitals,
  envTelemetry,
  telemetryMode,
  hardwareSourceLabel,
}: BioTwinBodyMapProps) {
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [visualMode, setVisualMode] = useState<ClinicalVisualMode>("atlas");
  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraResetToken, setCameraResetToken] = useState(0);

  return (
    <section
      aria-label="BioTwin Anatomical Body Map"
      className="flex min-h-0 flex-col overflow-hidden lg:h-full lg:flex-row"
    >
      {/* Left Sidebar (Compact Clinical Organ Node Selector & Cascade Feed) */}
      <aside className="flex shrink-0 flex-col justify-between border-b border-white/[0.07] bg-[#141414] p-3.5 lg:w-[248px] xl:w-[272px] lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              Organ Nodes
            </span>
            <span className="font-mono text-[11px] text-[#7e828a]">
              6 Systems
            </span>
          </div>

          {/* 3x2 Signature Squircle Avatar Grid */}
          <div className="grid grid-cols-3 gap-2">
            {SYSTEM_ORDER.map((systemId) => {
              const meta = BODY_SYSTEM_METADATA[systemId];
              const assessment = assessments[systemId];
              const style = STATUS_STYLE[assessment.status];
              const avatar = SYSTEM_AVATAR_COLOR[systemId];
              const isSelected = selectedSystem === systemId;

              return (
                <button
                  key={systemId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectSystem(systemId)}
                  className={`group relative flex flex-col items-center rounded-2xl border p-2.5 text-center transition active:scale-[0.98] ${
                    isSelected
                      ? "border-white/20 bg-[#202020] shadow-sm"
                      : "border-transparent bg-transparent hover:border-white/[0.08] hover:bg-[#1b1b1b]"
                  }`}
                >
                  <span
                    className={`absolute top-2 right-2 h-1.5 w-1.5 rounded-full ${style.dotClass}`}
                    title={style.label}
                  />

                  <BotMarkAvatar
                    color={avatar.hex}
                    shapeClass={avatar.shapeClass}
                    tilt={avatar.tilt}
                  />

                  <span className="mt-2 line-clamp-1 text-[11px] font-medium text-white">
                    {meta.shortLabel.split(" / ")[0]}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] tabular-nums text-[#7e828a]">
                    {assessment.score}/100
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Domino Cascade Monitor Feed */}
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              Domino Cascades
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums ${
                cascades.length > 0
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                  : "border-white/10 bg-[#1b1b1b] text-[#7e828a]"
              }`}
            >
              {cascades.length} Active
            </span>
          </div>

          {cascades.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-[#1b1b1b]/80 p-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white">
                  All Cascades Nominal
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#7e828a]">
                  No cross-organ hazard dominoes triggered.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {cascades.map((cascade) => {
                const isRed = cascade.severity === "red";
                return (
                  <button
                    key={cascade.id}
                    type="button"
                    onClick={() => onSelectSystem(cascade.toSystem)}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-transparent bg-[#1b1b1b]/70 p-2.5 text-left transition hover:border-white/10 hover:bg-[#202020]"
                  >
                    <BotMarkAvatar
                      color={isRed ? "#f87171" : "#fbbf24"}
                      shapeClass="rounded-full"
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-xs font-medium text-white">
                          {cascade.title}
                        </p>
                        <AlertTriangle
                          className={`h-3 w-3 shrink-0 ${
                            isRed ? "text-rose-400" : "text-amber-400"
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#7e828a]">
                        {cascade.immediateAction}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Center Anatomical Viewport */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-between overflow-hidden bg-[#0a0a0a] p-3 sm:p-4">
        {/* Viewport Top Telemetry Strip */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#7e828a] tabular-nums">
              {viewMode === "3d"
                ? "BIOTWIN // HRA-3D CLINICAL"
                : "BIOTWIN // X:210 Y:220"}
            </span>

            <div
              role="group"
              aria-label="BioTwin view mode"
              className="inline-flex items-center rounded-full border border-white/10 bg-[#141414] p-0.5"
            >
              <button
                type="button"
                onClick={() => setViewMode("3d")}
                aria-pressed={viewMode === "3d"}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  viewMode === "3d"
                    ? "bg-white text-black"
                    : "text-[#7e828a] hover:text-white"
                }`}
              >
                <Box className="h-3 w-3" aria-hidden="true" />
                3D BioTwin
              </button>
              <button
                type="button"
                onClick={() => setViewMode("2d")}
                aria-pressed={viewMode === "2d"}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  viewMode === "2d"
                    ? "bg-white text-black"
                    : "text-[#7e828a] hover:text-white"
                }`}
              >
                <Layers className="h-3 w-3" aria-hidden="true" />
                2D Blueprint
              </button>
            </div>
          </div>

          {viewMode === "3d" && (
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div
                role="group"
                aria-label="Clinical visualization mode"
                className="inline-flex items-center rounded-full border border-white/10 bg-[#141414] p-0.5"
              >
                {(
                  [
                    ["atlas", "Atlas"],
                    ["xray", "X-Ray CT"],
                    ["vascular", "Vascular"],
                  ] as const
                ).map(([modeKey, label]) => (
                  <button
                    key={modeKey}
                    type="button"
                    onClick={() => setVisualMode(modeKey)}
                    aria-pressed={visualMode === modeKey}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      visualMode === modeKey
                        ? "bg-white/15 text-white"
                        : "text-[#7e828a] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoRotate((prev) => !prev)}
                  aria-pressed={autoRotate}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    autoRotate
                      ? "border-white/25 bg-white/15 text-white"
                      : "border-white/10 bg-[#141414] text-[#7e828a] hover:text-white"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      autoRotate ? "bg-emerald-400" : "bg-[#7e828a]"
                    }`}
                  />
                  Auto-Rotate
                </button>

                <button
                  type="button"
                  onClick={() => setCameraResetToken((n) => n + 1)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-[#141414] px-2.5 py-1 text-[11px] font-medium text-[#7e828a] transition-colors hover:border-white/20 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Reset View
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Viewport Body: Interactive 3D Organ Atlas or 2D Blueprint SVG */}
        {viewMode === "3d" ? (
          <div className="relative my-1.5 flex-1 min-h-[420px] sm:min-h-[480px] lg:min-h-0 w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#070708]">
            <BioTwin3DStage
              assessments={assessments}
              cascades={cascades}
              selectedSystem={selectedSystem}
              onSelectSystem={onSelectSystem}
              onSelectSubStructure={onSelectSubStructure}
              vitals={vitals}
              envTelemetry={envTelemetry}
              telemetryMode={telemetryMode}
              hardwareSourceLabel={hardwareSourceLabel}
              visualMode={visualMode}
              autoRotate={autoRotate}
              cameraResetToken={cameraResetToken}
            />
          </div>
        ) : (
          <div className="my-1.5 flex min-h-0 flex-1 items-center justify-center">
            <svg
              viewBox="0 0 420 440"
              className="h-[380px] w-full max-w-[440px] sm:h-[460px] lg:h-full lg:max-h-full"
              role="img"
              aria-label="Interactive astronaut anatomical telemetry diagram"
            >
            <defs>
              <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
              </marker>
              <marker
                id="arrow-red"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f87171" />
              </marker>
            </defs>

            {/* Concentric Orbital Hairlines & Architectural Calibration Crosshairs */}
            <g fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1">
              <circle cx="210" cy="215" r="88" />
              <circle cx="210" cy="215" r="142" strokeDasharray="3 5" />
              <circle cx="210" cy="215" r="192" />
              <line x1="210" y1="12" x2="210" y2="428" strokeDasharray="2 6" />
              <line x1="122" y1="215" x2="298" y2="215" strokeDasharray="2 6" />
              {/* Corner Crosshair Ticks */}
              <path d="M 16 24 L 16 14 L 26 14" />
              <path d="M 394 14 L 404 14 L 404 24" />
              <path d="M 16 416 L 16 426 L 26 426" />
              <path d="M 394 426 L 404 426 L 404 416" />
            </g>

            {/* Anatomical Human Silhouette (Proportioned Cranium, Torso, Limbs) */}
            <g
              fill="rgba(255,255,255,0.025)"
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1.25"
              strokeLinejoin="round"
            >
              {/* Cranium & Jaw */}
              <path d="M 210 24 C 194 24 185 36 185 52 C 185 64 191 74 199 80 L 210 83 L 221 80 C 229 74 235 64 235 52 C 235 36 226 24 210 24 Z" />
              {/* Neck, Trapezius, Arms, Torso & Legs */}
              <path d="M 200 81 L 198 96 L 162 104 C 148 107 141 118 138 134 L 128 194 L 122 244 C 121 251 128 254 133 248 L 144 202 L 154 144 L 160 138 L 164 202 L 162 232 L 168 254 L 169 332 L 173 408 C 174 416 186 416 188 408 L 196 322 L 204 256 L 216 256 L 224 322 L 232 408 C 234 416 246 416 247 408 L 251 332 L 252 254 L 258 232 L 256 202 L 260 138 L 266 144 L 276 202 L 287 248 C 292 254 299 251 298 244 L 292 194 L 282 134 C 279 118 272 107 258 104 L 222 96 L 220 81" />
            </g>

            {/* Internal Anatomical & Skeletal Landmarks (Hairline Vector) */}
            <g fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1">
              {/* Cerebral Hemispheres & Optic Tracts */}
              <ellipse cx="202" cy="46" rx="9" ry="12" />
              <ellipse cx="218" cy="46" rx="9" ry="12" />
              <path d="M 203 55 L 210 62 L 217 55" />
              {/* Clavicles & Sternum */}
              <path d="M 164 108 Q 186 102 210 108 Q 234 102 256 108" />
              <line x1="210" y1="108" x2="210" y2="162" />
              {/* Ribcage Contours */}
              <path d="M 176 120 Q 210 116 244 120" />
              <path d="M 172 132 Q 210 128 248 132" />
              <path d="M 172 144 Q 210 140 248 144" />
              <path d="M 175 156 Q 210 152 245 156" />
              <path d="M 179 168 Q 210 176 241 168" />
              {/* Bilateral Lungs */}
              <path d="M 204 118 C 186 118 176 138 178 164 C 188 164 198 160 204 152 Z" />
              <path d="M 216 118 C 234 118 244 138 242 164 C 232 164 222 160 216 152 Z" />
              {/* Heart Contour */}
              <path d="M 212 142 C 218 138 228 143 226 156 C 224 164 214 168 209 160 C 206 152 208 145 212 142 Z" />
              {/* Hepatic / Liver Contour */}
              <path d="M 178 180 C 190 176 206 178 208 186 C 198 194 182 198 177 190 Z" />
              {/* Retroperitoneal Kidneys */}
              <ellipse cx="192" cy="212" rx="6.5" ry="10" />
              <ellipse cx="228" cy="212" rx="6.5" ry="10" />
              {/* Lumbar Spine & Pelvis / Femur Axes */}
              <line x1="210" y1="168" x2="210" y2="246" strokeDasharray="3 3" />
              <path d="M 172 228 Q 210 250 248 228" />
              <line x1="184" y1="256" x2="180" y2="395" strokeDasharray="3 4" />
              <line x1="236" y1="256" x2="240" y2="395" strokeDasharray="3 4" />
            </g>

            {/* Active Domino Cascade Bezier Conduits */}
            {cascades.map((cascade, index) => {
              const pathD = buildCascadeCurvePath(
                cascade.fromSystem,
                cascade.toSystem,
                index
              );
              const isRed = cascade.severity === "red";
              const strokeColor = isRed ? "#f87171" : "#fbbf24";
              return (
                <g key={cascade.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeOpacity="0.22"
                    strokeWidth="5"
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    markerEnd={isRed ? "url(#arrow-red)" : "url(#arrow-amber)"}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="18"
                      to="0"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              );
            })}

            {/* 6 Interactive Organ Nodes + Leader Callouts */}
            {SYSTEM_ORDER.map((systemId) => {
              const meta = BODY_SYSTEM_METADATA[systemId];
              const assessment = assessments[systemId];
              const style = STATUS_STYLE[assessment.status];
              const node = BLUEPRINT_NODES[systemId];
              const isSelected = selectedSystem === systemId;
              const isLeft = node.side === "left";
              const pillX = isLeft ? 8 : 298;
              const pillW = 114;
              const lineEndX = isLeft ? pillX + pillW : pillX;
              const shortTitle = meta.shortLabel.split(" / ")[0].toUpperCase();

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
                  {/* Leader Hairline */}
                  <polyline
                    points={`${node.cx},${node.cy} ${
                      isLeft ? node.cx - 26 : node.cx + 26
                    },${node.labelY + 11} ${lineEndX},${node.labelY + 11}`}
                    fill="none"
                    stroke={
                      isSelected
                        ? "rgba(255,255,255,0.65)"
                        : "rgba(255,255,255,0.18)"
                    }
                    strokeWidth={isSelected ? "1.25" : "0.9"}
                  />

                  {/* Pulsing Alert Ring */}
                  {assessment.status === "red" && (
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r="14"
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="1.5"
                    >
                      <animate
                        attributeName="r"
                        values="9;20;9"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.85;0.1;0.85"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Selected White Ring */}
                  {isSelected && (
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r="13"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.6"
                    />
                  )}

                  {/* Organ Node Dot */}
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r="6.5"
                    fill={style.color}
                    stroke="#0a0a0a"
                    strokeWidth="2"
                    filter="url(#node-glow)"
                  />

                  {/* Monospace Callout Tag */}
                  <rect
                    x={pillX}
                    y={node.labelY}
                    width={pillW}
                    height="22"
                    rx="11"
                    fill={isSelected ? "#ffffff" : "#141414"}
                    stroke={
                      isSelected ? "#ffffff" : "rgba(255,255,255,0.12)"
                    }
                    strokeWidth="1"
                  />
                  <circle
                    cx={pillX + 11}
                    cy={node.labelY + 11}
                    r="3"
                    fill={style.color}
                  />
                  <text
                    x={pillX + 19}
                    y={node.labelY + 14.5}
                    fill={isSelected ? "#0a0a0a" : "#ffffff"}
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {shortTitle}
                  </text>
                  <text
                    x={pillX + pillW - 9}
                    y={node.labelY + 14.5}
                    textAnchor="end"
                    fill={isSelected ? "#0a0a0a" : "#7e828a"}
                    fontSize="9.5"
                    fontWeight="600"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {assessment.score}
                  </text>

                  <title>{`${meta.name} — ${assessment.headline}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
        )}

        {/* Viewport Bottom Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-[#7e828a]">
          <span>
            {viewMode === "3d"
              ? "Drag to orbit · Scroll to zoom · Click 3D organ to inspect"
              : "Click any anatomical node or sidebar tile to inspect"}
          </span>
          <div className="flex items-center gap-3 font-mono">
            <span className="inline-flex items-center gap-1.5 text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              OK
            </span>
            <span className="inline-flex items-center gap-1.5 text-white">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Caution
            </span>
            <span className="inline-flex items-center gap-1.5 text-white">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Alert
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

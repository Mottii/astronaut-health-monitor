"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
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

const SYSTEM_ACCENT_HEX: Record<BodySystemId, string> = {
  neuro_ocular: "#2dd4bf",
  behavioral_circadian: "#818cf8",
  cardiovascular: "#fb7185",
  immune_hematology: "#c084fc",
  metabolic_endocrine: "#f97316",
  musculoskeletal_renal: "#4ade80",
};

const VISUAL_MODE_LABELS: Record<
  ClinicalVisualMode,
  { label: string; desc: string }
> = {
  atlas: { label: "Atlas", desc: "Layered organ & vascular surfaces" },
  xray: { label: "X-Ray CT", desc: "Translucent skeletal & shell radiogram" },
  vascular: { label: "Vascular", desc: "Hemodynamic arterial & venous flow" },
};

const STATUS_STYLE: Record<
  TriageStatus,
  {
    color: string;
    dotClass: string;
    barClass: string;
    label: string;
  }
> = {
  green: {
    color: "#34d399",
    dotClass: "bg-emerald-400",
    barClass: "bg-emerald-400/70",
    label: "NOMINAL",
  },
  amber: {
    color: "#fbbf24",
    dotClass: "bg-amber-400",
    barClass: "bg-amber-400/80",
    label: "CAUTION",
  },
  red: {
    color: "#f87171",
    dotClass: "bg-rose-400",
    barClass: "bg-rose-400/85",
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

/**
 * Precision 1.25px vector anatomical glyph for each NASA HRP organ system,
 * replacing generic icon badges.
 */
function OrganSystemGlyph({
  systemId,
  accentHex,
  active,
}: {
  systemId: BodySystemId;
  accentHex: string;
  active: boolean;
}) {
  const stroke = active ? accentHex : "rgba(255,255,255,0.68)";
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors ${
        active
          ? "border-white/20 bg-[#232327]"
          : "border-white/[0.06] bg-[#161618] group-hover:border-white/15"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        {systemId === "neuro_ocular" && (
          <>
            <path
              d="M3 12C5.4 7.8 8.4 6 12 6C15.6 6 18.6 7.8 21 12C18.6 16.2 15.6 18 12 18C8.4 18 5.4 16.2 3 12Z"
              stroke={stroke}
              strokeWidth="1.3"
            />
            <circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth="1.3" />
            <circle cx="12" cy="12" r="1" fill={stroke} />
          </>
        )}
        {systemId === "behavioral_circadian" && (
          <>
            <path
              d="M3.5 13C6 13 6.8 7.5 9.3 7.5C11.8 7.5 12.4 16.5 14.9 16.5C17.4 16.5 18.2 11 20.5 11"
              stroke={stroke}
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle
              cx="12"
              cy="12"
              r="8.5"
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="2 2.5"
              strokeWidth="1"
            />
          </>
        )}
        {systemId === "cardiovascular" && (
          <path
            d="M2.5 12.5H6.5L8.6 7L11.4 17.5L13.8 10.5L15.6 12.5H21.5"
            stroke={stroke}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {systemId === "immune_hematology" && (
          <>
            <polygon
              points="12,3.5 19,7.5 19,16.5 12,20.5 5,16.5 5,7.5"
              stroke={stroke}
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2.2" stroke={stroke} strokeWidth="1.2" />
            <path
              d="M12 6V9.5M17 9L14 10.8M17 15L14 13.2"
              stroke={stroke}
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </>
        )}
        {systemId === "metabolic_endocrine" && (
          <>
            <circle
              cx="12"
              cy="12"
              r="7.5"
              stroke={stroke}
              strokeWidth="1.25"
              strokeDasharray="11 4"
            />
            <path
              d="M8.5 12.5C9.5 9.8 14.5 9.8 15.5 12.5C14.5 15.2 9.5 15.2 8.5 12.5Z"
              stroke={stroke}
              strokeWidth="1.2"
            />
            <circle cx="12" cy="12.5" r="1.1" fill={stroke} />
          </>
        )}
        {systemId === "musculoskeletal_renal" && (
          <>
            <path
              d="M9 4.5C7 4.5 5.8 6.4 6 8.5C6.2 10.3 7.5 11.2 8 12.5C8.5 14 7.4 16 8.5 17.8C9.3 19 10.8 19.2 11.2 17.6L11.5 7.5C11.5 5.6 10.6 4.5 9 4.5Z"
              stroke={stroke}
              strokeWidth="1.25"
            />
            <path
              d="M15 6.5C17 6.5 18.2 8.4 18 10.5C17.8 12.3 16.5 13.2 16 14.5C15.5 16 16.4 17.6 15.2 19C14.3 19.9 13 19.5 12.8 18"
              stroke={stroke}
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
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
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setViewMenuOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [viewMenuOpen]);

  return (
    <section
      aria-label="BioTwin Anatomical Body Map"
      className="flex min-h-0 flex-col overflow-hidden bg-[#0f0f10] lg:h-full lg:flex-row"
    >
      {/* Left Sidebar (Restrained Monochrome Organ Nodes & Domino Feed) */}
      <aside className="flex shrink-0 flex-col justify-between border-b border-white/[0.06] bg-[#111113] p-3.5 lg:w-[244px] xl:w-[264px] lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              Organ Nodes
            </span>
            <span className="font-mono text-[10.5px] text-[#5e626a]">
              6 Systems
            </span>
          </div>

          {/* 3x2 Monochrome Anatomical Node Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {SYSTEM_ORDER.map((systemId) => {
              const meta = BODY_SYSTEM_METADATA[systemId];
              const assessment = assessments[systemId];
              const style = STATUS_STYLE[assessment.status];
              const accentHex = SYSTEM_ACCENT_HEX[systemId];
              const isSelected = selectedSystem === systemId;

              return (
                <button
                  key={systemId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectSystem(systemId)}
                  className={`group relative flex cursor-pointer flex-col items-center rounded-xl border p-2 text-center transition active:scale-[0.98] ${
                    isSelected
                      ? "border-white/20 bg-[#1c1c1f]"
                      : "border-white/[0.04] bg-[#151517]/80 hover:border-white/10 hover:bg-[#1a1a1d]"
                  }`}
                >
                  <span
                    className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${style.dotClass}`}
                    title={style.label}
                  />

                  <OrganSystemGlyph
                    systemId={systemId}
                    accentHex={accentHex}
                    active={isSelected}
                  />

                  <span className="mt-2 line-clamp-1 text-[10.5px] font-medium text-[#e4e4e7]">
                    {meta.shortLabel.split(" / ")[0]}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] tabular-nums text-[#71717a]">
                    {assessment.score}/100
                  </span>
                  <span className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`block h-full rounded-full ${style.barClass}`}
                      style={{
                        width: `${Math.max(8, Math.min(100, assessment.score))}%`,
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Domino Cascade Monitor Feed */}
        <div className="mt-4 border-t border-white/[0.06] pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              Domino Cascades
            </span>
            <span
              className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                cascades.length > 0
                  ? "border-amber-400/25 bg-[#1b1812] text-amber-300"
                  : "border-white/[0.07] bg-[#161618] text-[#71717a]"
              }`}
            >
              {cascades.length} Active
            </span>
          </div>

          {cascades.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-[#151517] px-3 py-2.5">
              <svg
                viewBox="0 0 16 16"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="1.25"
                />
                <path
                  d="M5.5 8.2L7.2 9.8L10.8 6.2"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-[#e4e4e7]">
                  All Cascades Nominal
                </p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-[#71717a]">
                  No cross-organ hazard dominoes active.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {cascades.map((cascade) => {
                const isRed = cascade.severity === "red";
                const fromShort = BODY_SYSTEM_METADATA[cascade.fromSystem].shortLabel
                  .split(" / ")[0]
                  .toUpperCase();
                const toShort = BODY_SYSTEM_METADATA[cascade.toSystem].shortLabel
                  .split(" / ")[0]
                  .toUpperCase();
                return (
                  <button
                    key={cascade.id}
                    type="button"
                    onClick={() => onSelectSystem(cascade.toSystem)}
                    className={`flex w-full cursor-pointer items-stretch gap-2.5 rounded-xl border border-white/[0.06] bg-[#151517] p-2.5 text-left transition hover:border-white/15 hover:bg-[#1a1a1d]`}
                  >
                    <span
                      className={`w-[2px] shrink-0 rounded-full ${
                        isRed ? "bg-rose-400" : "bg-amber-400"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-[11.5px] font-medium text-[#f4f4f5]">
                          {cascade.title}
                        </p>
                        <span
                          className={`shrink-0 font-mono text-[9.5px] font-semibold uppercase ${
                            isRed ? "text-rose-400" : "text-amber-300"
                          }`}
                        >
                          {isRed ? "HIGH" : "WARN"}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[9.5px] text-[#71717a]">
                        {fromShort} → {toShort}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-[#a1a1aa]">
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
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-between overflow-hidden bg-[#0a0a0b] p-3 sm:p-3.5">
        {/* Single Compact Telemetry Bar + Engine View Menu */}
        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                viewMode === "3d" ? "bg-emerald-400" : "bg-zinc-400"
              }`}
            />
            <span className="truncate font-mono text-[10.5px] uppercase tracking-wider text-[#71717a] tabular-nums">
              {viewMode === "3d"
                ? `BIOTWIN // HRA-3D · ${VISUAL_MODE_LABELS[visualMode].label.toUpperCase()}`
                : "BIOTWIN // 2D BLUEPRINT · X:210 Y:220"}
            </span>
          </div>

          <div
            ref={menuContainerRef}
            className="relative flex shrink-0 items-center gap-1.5"
          >
            {viewMode === "3d" && (
              <button
                type="button"
                onClick={() => setCameraResetToken((n) => n + 1)}
                title="Reset 3D Camera Orbit"
                aria-label="Reset 3D Camera Orbit"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] bg-[#141416] text-[#8b909a] transition hover:border-white/20 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              data-testid="biotwin-view-menu-btn"
              aria-expanded={viewMenuOpen}
              aria-haspopup="menu"
              onClick={() => setViewMenuOpen((prev) => !prev)}
              className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition ${
                viewMenuOpen
                  ? "border-white/25 bg-[#202024] text-white"
                  : "border-white/[0.08] bg-[#141416] text-[#d4d4d8] hover:border-white/20 hover:text-white"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3 text-[#8b909a]" aria-hidden="true" />
              <span>
                {viewMode === "3d"
                  ? `View · ${VISUAL_MODE_LABELS[visualMode].label}`
                  : "View · 2D"}
              </span>
              <ChevronDown
                className={`h-3 w-3 text-[#71717a] transition-transform ${
                  viewMenuOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {viewMenuOpen && (
              <div
                role="menu"
                data-testid="biotwin-view-menu-popover"
                className="absolute top-9 right-0 z-30 w-64 rounded-2xl border border-white/[0.09] bg-[#121214]/95 p-2.5 shadow-2xl backdrop-blur-xl"
              >
                <div className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#71717a]">
                  Projection Engine
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-[#0a0a0b] p-0.5">
                  <button
                    type="button"
                    role="menuitemradio"
                    data-testid="view-mode-3d-btn"
                    aria-checked={viewMode === "3d"}
                    onClick={() => setViewMode("3d")}
                    className={`cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                      viewMode === "3d"
                        ? "bg-white text-[#0a0a0a]"
                        : "text-[#8b909a] hover:text-white"
                    }`}
                  >
                    3D BioTwin
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    data-testid="view-mode-2d-btn"
                    aria-checked={viewMode === "2d"}
                    onClick={() => setViewMode("2d")}
                    className={`cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                      viewMode === "2d"
                        ? "bg-white text-[#0a0a0a]"
                        : "text-[#8b909a] hover:text-white"
                    }`}
                  >
                    2D Blueprint
                  </button>
                </div>

                {viewMode === "3d" && (
                  <>
                    <div className="mt-2.5 border-t border-white/[0.06] pt-2">
                      <div className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#71717a]">
                        Clinical Shader
                      </div>
                      <div className="space-y-0.5">
                        {(["atlas", "xray", "vascular"] as const).map(
                          (modeKey) => {
                            const active = visualMode === modeKey;
                            const meta = VISUAL_MODE_LABELS[modeKey];
                            return (
                              <button
                                key={modeKey}
                                type="button"
                                role="menuitemradio"
                                data-testid={`shader-mode-${modeKey}-btn`}
                                aria-checked={active}
                                onClick={() => setVisualMode(modeKey)}
                                className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2 py-1.5 text-left transition ${
                                  active
                                    ? "bg-white/[0.08] text-white"
                                    : "text-[#a1a1aa] hover:bg-white/[0.04] hover:text-white"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-[11.5px] font-medium">
                                    {meta.label}
                                  </p>
                                  <p className="truncate text-[10px] text-[#71717a]">
                                    {meta.desc}
                                  </p>
                                </div>
                                {active && (
                                  <Check
                                    className="h-3.5 w-3.5 shrink-0 text-white"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="mt-2 border-t border-white/[0.06] pt-2 space-y-1">
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        data-testid="toggle-autorotate-btn"
                        aria-checked={autoRotate}
                        onClick={() => setAutoRotate((prev) => !prev)}
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2 py-1.5 text-[11.5px] font-medium text-[#d4d4d8] transition hover:bg-white/[0.04] hover:text-white"
                      >
                        <span>Auto-Rotate Turntable</span>
                        <span
                          className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition ${
                            autoRotate ? "bg-white" : "bg-white/15"
                          }`}
                        >
                          <span
                            className={`h-3 w-3 rounded-full transition-transform ${
                              autoRotate
                                ? "translate-x-3 bg-[#0a0a0a]"
                                : "translate-x-0 bg-[#71717a]"
                            }`}
                          />
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCameraResetToken((n) => n + 1);
                          setViewMenuOpen(false);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[11.5px] font-medium text-[#a1a1aa] transition hover:bg-white/[0.04] hover:text-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Reset Camera Orbit</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
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

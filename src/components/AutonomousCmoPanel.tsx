"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crosshair,
  ExternalLink,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  BODY_SYSTEM_METADATA,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import { DEFAULT_INFERENCE_CONFIG } from "@/lib/crewProfileStorage";
import { formatFlightSurgeonPacket } from "@/lib/triageEngine";
import {
  computeOrganSensitivityMultipliers,
  generateTwinConsultationSummary,
  simulatePersonalizedDrugResponse,
  type TwinConsultationResult,
} from "@/lib/twinEngine";
import type {
  AstronautBiologicalProfile,
  BiometricSourceType,
  BodySystemId,
  CmoWorkflowStage,
  CountermeasureActionSpec,
  EnvironmentTelemetry,
  ExamStepFinding,
  ExecutedActionLog,
  HealthEvaluationResult,
  IssLiveTelemetrySnapshot,
  MissionEnvironmentId,
  OcularFinding,
  SelectedSubStructure,
  TelemetryMode,
  TriageStatus,
  TwinInferenceConfig,
  TwinInferenceMode,
  VitalReadings,
} from "@/types/health";

export interface AutonomousCmoPanelProps {
  selectedSystem: BodySystemId;
  evaluation: HealthEvaluationResult;
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
  envId: MissionEnvironmentId;
  selectedSubStructure?: SelectedSubStructure | null;
  onClearSubStructure?: () => void;
  onExecuteCountermeasure?: (action: CountermeasureActionSpec) => void;
  executedActions?: ExecutedActionLog[];
  onOcularFindingChange?: (finding: OcularFinding) => void;
  examFindings?: Record<string, ExamStepFinding>;
  onUpdateExamFinding?: (
    stepKey: string,
    finding: ExamStepFinding
  ) => void;
  onResetSystemExam?: (systemId: BodySystemId) => void;
  telemetryMode?: TelemetryMode;
  biometricSource?: BiometricSourceType;
  issSnapshot?: IssLiveTelemetrySnapshot | null;
  crewProfile?: AstronautBiologicalProfile | null;
  inferenceMode?: TwinInferenceMode;
  inferenceConfig?: TwinInferenceConfig;
}

const STATUS_META: Record<
  TriageStatus,
  { label: string; strokeHex: string; dotClass: string; textClass: string }
> = {
  green: {
    label: "NOMINAL",
    strokeHex: "#34d399",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-300",
  },
  amber: {
    label: "ELEVATED",
    strokeHex: "#fbbf24",
    dotClass: "bg-amber-400",
    textClass: "text-amber-300",
  },
  red: {
    label: "CRITICAL",
    strokeHex: "#f87171",
    dotClass: "bg-rose-400",
    textClass: "text-rose-300",
  },
};

/** Bespoke RF carrier waveform + latency telemetry asset for the panel header. */
function FlightLinkSignalAsset({
  isAutonomous,
  commDelayLabel,
}: {
  isAutonomous: boolean;
  commDelayLabel: string;
}) {
  const accent = isAutonomous ? "#fbbf24" : "#34d399";
  const barHeights = isAutonomous ? [4, 7, 10, 6, 4] : [6, 11, 14, 10, 13];
  return (
    <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-[#0b0b0d] px-2.5 py-1">
      <svg
        viewBox="0 0 22 16"
        className="h-3.5 w-5 shrink-0"
        fill="none"
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <rect
            key={i}
            x={1 + i * 4.2}
            y={15 - h}
            width="2.2"
            height={h}
            rx="1"
            fill={accent}
            opacity={i === 3 && isAutonomous ? 0.35 : 0.92}
          />
        ))}
      </svg>
      <span className="truncate font-mono text-[10.5px] font-medium tracking-tight text-[#e4e4e7]">
        {isAutonomous ? "Autonomous CMO" : "Flight Link Live"}
      </span>
      <span className="font-mono text-[10px] text-[#71717a]">
        {commDelayLabel}
      </span>
    </div>
  );
}

/** Precision radial score ring replacing plain pill scores. */
function RadialScoreGauge({
  score,
  status,
}: {
  score: number;
  status: TriageStatus;
}) {
  const meta = STATUS_META[status];
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="text-right">
        <span className="block font-mono text-[9.5px] uppercase tracking-wider text-[#71717a]">
          {meta.label}
        </span>
        <span className="block font-mono text-[11px] font-semibold tabular-nums text-white">
          {score}/100
        </span>
      </div>
      <svg
        viewBox="0 0 36 36"
        className="h-9 w-9 shrink-0"
        aria-label={`System readiness ${score} out of 100`}
      >
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2.5"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={meta.strokeHex}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 18 18)"
        />
        <circle cx="18" cy="18" r="2.2" fill={meta.strokeHex} />
      </svg>
    </div>
  );
}

/** Horizontal pharmacogenomic sensitivity tick bar for crew baseline banner. */
function SensitivityScaleAsset({ multiplier }: { multiplier: number }) {
  // Map 0.75x .. 1.80x onto 0 .. 100%
  const pct = Math.max(
    4,
    Math.min(96, ((multiplier - 0.75) / (1.8 - 0.75)) * 100)
  );
  const accent =
    multiplier >= 1.35
      ? "#fb7185"
      : multiplier >= 1.15
      ? "#fbbf24"
      : "#34d399";
  return (
    <svg
      viewBox="0 0 96 14"
      className="h-3.5 w-24 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <line
        x1="4"
        y1="7"
        x2="92"
        y2="7"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 1.0x reference notch */}
      <line
        x1="25"
        y1="3.5"
        x2="25"
        y2="10.5"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
      />
      <rect
        x="4"
        y="5.5"
        width={Math.max(4, (pct / 100) * 88)}
        height="3"
        rx="1.5"
        fill={accent}
        opacity="0.85"
      />
      <circle cx={4 + (pct / 100) * 88} cy="7" r="3" fill={accent} />
    </svg>
  );
}

/** Crisp SVG hairline status glyph for telemetry finding rows. */
function DiagnosticTickIcon({ status }: { status: TriageStatus }) {
  const color = STATUS_META[status].strokeHex;
  return (
    <svg
      viewBox="0 0 14 14"
      className="mt-0.5 h-3.5 w-3.5 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      {status === "green" ? (
        <>
          <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.2" />
          <path
            d="M4.8 7.1L6.3 8.5L9.4 5.4"
            stroke={color}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <rect
            x="2"
            y="2"
            width="10"
            height="10"
            rx="3"
            stroke={color}
            strokeWidth="1.2"
          />
          <circle cx="7" cy="7" r="1.6" fill={color} />
        </>
      )}
    </svg>
  );
}

function InteractiveAmslerGrid({
  finding,
  onSelect,
}: {
  finding: OcularFinding;
  onSelect: (next: OcularFinding) => void;
}) {
  const distortionAmp =
    finding === "visual_halos" ? 5.5 : finding === "blurry_near" ? 2.2 : 0;

  const gridLines: string[] = [];
  const size = 140;
  const step = 14;
  for (let i = 0; i <= 10; i++) {
    const pos = i * step;
    if (distortionAmp === 0) {
      gridLines.push(`M 0 ${pos} L ${size} ${pos}`);
      gridLines.push(`M ${pos} 0 L ${pos} ${size}`);
    } else {
      const distFromCenter = Math.abs(pos - size / 2);
      const factor = Math.max(0, 1 - distFromCenter / (size * 0.7)) * distortionAmp;
      gridLines.push(
        `M 0 ${pos} Q ${size * 0.3} ${pos - factor} ${size * 0.5} ${pos + factor * 0.6} T ${size} ${pos}`
      );
      gridLines.push(
        `M ${pos} 0 Q ${pos + factor} ${size * 0.3} ${pos - factor * 0.6} ${size * 0.5} T ${pos} ${size}`
      );
    }
  }

  return (
    <div
      data-testid="amsler-grid-widget"
      className="mt-2.5 rounded-xl border border-white/[0.07] bg-[#0d0d0f] p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#070708] p-2">
          <svg
            viewBox="-4 -4 148 148"
            className={`h-28 w-28 ${
              finding === "blurry_near" ? "blur-[0.65px]" : ""
            }`}
            role="img"
            aria-label="Interactive Amsler Grid"
          >
            <path
              d={gridLines.join(" ")}
              fill="none"
              stroke={
                finding === "visual_halos"
                  ? "rgba(248,113,113,0.75)"
                  : finding === "blurry_near"
                  ? "rgba(251,191,36,0.75)"
                  : "rgba(52,211,153,0.6)"
              }
              strokeWidth="0.9"
            />
            {finding === "visual_halos" && (
              <circle
                cx="70"
                cy="70"
                r="24"
                fill="none"
                stroke="rgba(248,113,113,0.45)"
                strokeWidth="5"
                strokeDasharray="3 3"
              />
            )}
            <circle cx="70" cy="70" r="3" fill="#ffffff" />
          </svg>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#71717a]">
              Interactive Amsler Check
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                finding === "clear"
                  ? "border-emerald-500/25 bg-[#121614] text-emerald-300"
                  : finding === "blurry_near"
                  ? "border-amber-500/25 bg-[#171410] text-amber-300"
                  : "border-rose-500/30 bg-[#191113] text-rose-300"
              }`}
            >
              {finding === "clear"
                ? "Crisp"
                : finding === "blurry_near"
                ? "Near Blur"
                : "Wavy / Halos"}
            </span>
          </div>
          <p className="text-[11px] leading-snug text-[#a1a1aa]">
            Fixate on center white dot one eye at a time at 35 cm. Tap observed
            grid state to update SANS telemetry:
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["clear", "Crisp"],
                ["blurry_near", "Near Blur"],
                ["visual_halos", "Wavy/Halos"],
              ] as const
            ).map(([val, lbl]) => {
              const active = finding === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onSelect(val)}
                  aria-pressed={active}
                  className={`min-h-[36px] cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "border-white/30 bg-white text-[#0a0a0a]"
                      : "border-white/[0.08] bg-[#151517] text-[#a1a1aa] hover:border-white/20 hover:text-white"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function InteractiveOnsdCaliper({
  measuredValue,
  onSelect,
}: {
  measuredValue?: string;
  onSelect: (mmLabel: string, escalated: boolean) => void;
}) {
  const presets = [
    { label: "4.6 mm", desc: "Nominal <=5.0", escalated: false },
    { label: "5.2 mm", desc: "Borderline", escalated: true },
    { label: "5.9 mm", desc: "Distended >5.5", escalated: true },
  ];

  return (
    <div
      data-testid="onsd-caliper-widget"
      className="mt-2.5 rounded-xl border border-white/[0.07] bg-[#0d0d0f] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#71717a]">
          Ocular Ultrasound ONSD Caliper (3 mm retrobulbar)
        </span>
        {measuredValue && (
          <span className="rounded-md border border-white/10 bg-[#161618] px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
            {measuredValue}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {presets.map((p) => {
          const active = measuredValue === p.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onSelect(p.label, p.escalated)}
              aria-pressed={active}
              className={`flex min-h-[42px] cursor-pointer flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition ${
                active
                  ? "border-white/30 bg-white text-[#0a0a0a]"
                  : "border-white/[0.08] bg-[#151517] text-[#a1a1aa] hover:border-white/20 hover:text-white"
              }`}
            >
              <span className="font-mono text-xs font-semibold">{p.label}</span>
              <span className="text-[9.5px] opacity-80">{p.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AutonomousCmoPanel({
  selectedSystem,
  evaluation,
  vitals,
  envTelemetry,
  envId,
  selectedSubStructure,
  onClearSubStructure,
  onExecuteCountermeasure,
  executedActions = [],
  onOcularFindingChange,
  examFindings: externalExamFindings,
  onUpdateExamFinding,
  onResetSystemExam,
  telemetryMode,
  biometricSource,
  issSnapshot,
  crewProfile,
  inferenceMode,
  inferenceConfig,
}: AutonomousCmoPanelProps) {
  const [stage, setStage] = useState<CmoWorkflowStage>("overview");
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [internalExamFindings, setInternalExamFindings] = useState<
    Record<string, ExamStepFinding>
  >({});
  const [copied, setCopied] = useState<boolean>(false);
  const [queuedAt, setQueuedAt] = useState<string | null>(null);
  const [consultation, setConsultation] =
    useState<TwinConsultationResult | null>(null);
  const [isConsulting, setIsConsulting] = useState<boolean>(false);

  useEffect(() => {
    setActiveStepIdx(0);
    setStage("overview");
  }, [selectedSystem]);

  useEffect(() => {
    setConsultation(null);
  }, [crewProfile?.id, inferenceConfig?.mode, inferenceMode, envId]);

  async function handleRunLiveConsultation() {
    if (!crewProfile || isConsulting) return;
    setIsConsulting(true);
    try {
      const cfg: TwinInferenceConfig = inferenceConfig ?? {
        ...DEFAULT_INFERENCE_CONFIG,
        mode: inferenceMode ?? DEFAULT_INFERENCE_CONFIG.mode,
      };
      const res = await generateTwinConsultationSummary(
        crewProfile,
        evaluation,
        cfg,
        {
          vitals,
          envTelemetry,
          envId,
          activeDrugIds: executedActions.map((a) => a.actionId),
          executedActions,
        }
      );
      setConsultation(res);
    } finally {
      setIsConsulting(false);
    }
  }

  const examFindings = externalExamFindings ?? internalExamFindings;

  function setStepFinding(stepKey: string, finding: ExamStepFinding) {
    if (onUpdateExamFinding) {
      onUpdateExamFinding(stepKey, finding);
    } else {
      setInternalExamFindings((prev) => ({
        ...prev,
        [stepKey]: finding,
      }));
    }
  }

  function resetCurrentExam() {
    if (onResetSystemExam) {
      onResetSystemExam(selectedSystem);
    } else {
      setInternalExamFindings((prev) => {
        const next = { ...prev };
        for (const step of BODY_SYSTEM_METADATA[selectedSystem].selfExamSteps) {
          delete next[`${selectedSystem}-${step.stepNumber}`];
        }
        return next;
      });
    }
    setActiveStepIdx(0);
  }

  const metadata = BODY_SYSTEM_METADATA[selectedSystem];
  const assessment = evaluation.systems[selectedSystem];
  const envConfig = MISSION_ENVIRONMENTS[envId];
  const isAutonomousMode =
    envConfig.autonomousModeRequired || evaluation.autonomousTriageRequired;

  const steps = metadata.selfExamSteps;
  const currentStep = steps[Math.min(activeStepIdx, steps.length - 1)];

  const verifiedCount = steps.filter((step) => {
    const f = examFindings[`${selectedSystem}-${step.stepNumber}`];
    return f && f.status !== "pending";
  }).length;

  const systemCountermeasures = EXECUTABLE_COUNTERMEASURES[selectedSystem] ?? [];
  const systemExecutedCount = executedActions.filter(
    (a) => a.systemId === selectedSystem
  ).length;

  const pinnedSub =
    selectedSubStructure && selectedSubStructure.systemId === selectedSystem
      ? selectedSubStructure
      : null;

  const packetText = formatFlightSurgeonPacket(
    evaluation,
    vitals,
    envTelemetry,
    envId,
    {
      subStructure: pinnedSub,
      examFindings,
      executedActions,
      telemetryMode,
      biometricSource,
      issSnapshot,
      crewProfile,
      inferenceMode: inferenceConfig?.mode ?? inferenceMode,
      consultation,
    }
  );

  async function handleCopyPacket() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(packetText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
    }
  }

  function handleQueueTelemetry() {
    const now = new Date();
    const utc = `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes()
    ).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")} UTC`;
    setQueuedAt(utc);
  }

  function logCurrentStep(
    status: "normal" | "escalated",
    measuredValue?: string,
    note?: string,
    autoAdvance = true
  ) {
    const key = `${selectedSystem}-${currentStep.stepNumber}`;
    setStepFinding(key, {
      status,
      measuredValue,
      note:
        note ??
        (status === "normal"
          ? currentStep.normalObservation
          : currentStep.escalationTrigger),
      updatedAt: new Date().toISOString().slice(11, 19) + "Z",
    });
    if (autoAdvance && activeStepIdx < steps.length - 1) {
      setActiveStepIdx((i) => Math.min(steps.length - 1, i + 1));
    }
  }

  return (
    <section
      aria-label="Autonomous Chief Medical Officer Clinical Console"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#111113]"
    >
      {/* Top Pinned Clinical Header + Bespoke Telemetry Assets */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#111113] p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <FlightLinkSignalAsset
            isAutonomous={isAutonomousMode}
            commDelayLabel={envConfig.commDelayLabel}
          />
          <RadialScoreGauge
            score={assessment.score}
            status={assessment.status}
          />
        </div>

        <div className="mt-2.5">
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-white">
            {metadata.name}
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-[#71717a]">
            {metadata.organSummary}
          </p>
        </div>

        {/* 4-Stage Segmented Action Deck Selector */}
        <div
          role="tablist"
          aria-label="CMO workflow stages"
          className="mt-3 grid grid-cols-4 gap-1 rounded-xl border border-white/[0.06] bg-[#0a0a0b] p-1"
        >
          {(
            [
              { id: "overview", label: "1. Triage" },
              {
                id: "exam",
                label: `2. Exam ${verifiedCount}/${steps.length}`,
              },
              {
                id: "intervene",
                label:
                  systemExecutedCount > 0
                    ? `3. Act (${systemExecutedCount})`
                    : "3. Act",
              },
              { id: "downlink", label: "4. Link" },
            ] as const
          ).map((tab) => {
            const active = stage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`cmo-stage-${tab.id}`}
                onClick={() => setStage(tab.id)}
                className={`min-h-[34px] cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                  active
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#8b909a] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Active Clinical Stage Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4">
        {stage === "overview" && (
          <div className="flex flex-col gap-2.5">
            {pinnedSub && (
              <div
                data-testid="pinned-substructure-card"
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#161618] px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Crosshair
                    className="h-3.5 w-3.5 shrink-0 text-[#a1a1aa]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      Pinned: {pinnedSub.displayLabel}
                    </p>
                    <p className="truncate font-mono text-[10px] text-[#71717a]">
                      {pinnedSub.layer} · {pinnedSub.tissueTag}
                    </p>
                  </div>
                </div>
                {onClearSubStructure && (
                  <button
                    type="button"
                    onClick={onClearSubStructure}
                    aria-label="Clear pinned 3D sub-structure"
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#71717a] hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {crewProfile && (() => {
              const mults = computeOrganSensitivityMultipliers(crewProfile);
              const sysMult = mults[selectedSystem];
              return (
                <div
                  data-testid="active-crew-biotwin-banner"
                  className="space-y-2 rounded-xl border border-white/[0.06] bg-[#151517] px-3 py-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {crewProfile.callsign} · {crewProfile.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-[#71717a]">
                        {crewProfile.summaryTag}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 font-mono">
                      <span
                        className={`text-[10.5px] font-semibold tabular-nums ${
                          sysMult >= 1.35
                            ? "text-rose-300"
                            : sysMult >= 1.15
                            ? "text-amber-300"
                            : "text-[#d4d4d8]"
                        }`}
                      >
                        {sysMult.toFixed(2)}x Risk Weight
                      </span>
                      <SensitivityScaleAsset multiplier={sysMult} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
                    <span className="font-mono text-[10px] text-[#8b909a]">
                      Engine: {(inferenceConfig?.mode ?? inferenceMode ?? "local_mechanistic").replace(/_/g, " ")}
                    </span>
                    <button
                      type="button"
                      data-testid="cmo-run-consultation-btn"
                      onClick={handleRunLiveConsultation}
                      disabled={isConsulting}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-[#1d1d21] px-2.5 py-1 text-[10.5px] font-medium text-white transition hover:border-white/30 disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                      <span>
                        {isConsulting ? "Synthesizing..." : "Run BioTwin AI"}
                      </span>
                    </button>
                  </div>

                  {consultation && (
                    <div
                      data-testid="cmo-consultation-card"
                      className="space-y-1.5 rounded-lg border border-white/[0.07] bg-[#0e0e10] p-2.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between font-mono text-[9.5px] text-[#a1a1aa]">
                        <span>{consultation.engineUsed}</span>
                        <span className="uppercase">{consultation.source}</span>
                      </div>
                      {consultation.source === "fallback" &&
                        consultation.fallbackReason && (
                          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10.5px] text-amber-200">
                            {consultation.fallbackReason}
                          </div>
                        )}
                      {consultation.guardrailConflict && (
                        <div className="space-y-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10.5px] text-rose-200">
                          <div>
                            <strong>Guardrail Conflict:</strong>{" "}
                            {consultation.conflictReason}
                          </div>
                          <div className="font-mono text-[10px] text-rose-100/90">
                            {consultation.deterministicGuardrail}
                          </div>
                        </div>
                      )}
                      <pre className="whitespace-pre-wrap font-sans text-[11px] leading-snug text-[#e4e4e7]">
                        {consultation.summaryText}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()}

            {isAutonomousMode && (
              <div
                role="status"
                className="flex items-stretch gap-2.5 rounded-xl border border-white/[0.06] bg-[#151517] px-3 py-2.5 text-xs"
              >
                <span
                  className="w-[2px] shrink-0 rounded-full bg-amber-400"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="font-medium text-[#f4f4f5]">
                    Deep-Space Autonomous Protocol Active
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#71717a]">
                    Round-trip link exceeds clinical action window. Complete Guided
                    Self-Exam and Countermeasures before Houston downlink.
                  </p>
                </div>
              </div>
            )}

            {/* Diagnostic Telemetry Feed (Restrained Monochrome Hairline List) */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#151517]">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-3.5 py-2.5">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#71717a]">
                  Telemetry Findings
                </span>
                <span className="truncate font-mono text-[10.5px] font-medium text-[#e4e4e7]">
                  {assessment.headline}
                </span>
              </div>

              <ul className="divide-y divide-white/[0.05]">
                {assessment.findings.map((finding, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 px-3.5 py-2.5 text-[12px] text-[#f4f4f5]"
                  >
                    <DiagnosticTickIcon status={assessment.status} />
                    <span className="leading-snug">{finding}</span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-white/[0.05] bg-[#111113] px-3.5 py-2.5 text-[11px] text-[#a1a1aa]">
                <div className="border-l-2 border-white/20 pl-2.5 leading-snug">
                  <span className="font-medium text-white">
                    Space Baseline Shift —{" "}
                  </span>
                  {assessment.earthVsSpaceNote}
                </div>
              </div>
            </div>

            {/* Collapsible NASA HRP & OSDR Evidence Accordion */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#151517]">
              <button
                type="button"
                onClick={() => setShowEvidence((prev) => !prev)}
                aria-expanded={showEvidence}
                className="flex min-h-[40px] w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-[#e4e4e7] transition hover:bg-white/[0.03]"
              >
                <span>NASA HRP Risk &amp; OSDR Rationale</span>
                {showEvidence ? (
                  <ChevronUp
                    className="h-3.5 w-3.5 shrink-0 text-[#71717a]"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-[#71717a]"
                    aria-hidden="true"
                  />
                )}
              </button>

              {showEvidence && (
                <div className="space-y-2.5 border-t border-white/[0.05] bg-[#111113] px-3.5 py-3 text-xs">
                  <p className="leading-relaxed text-[#a1a1aa]">
                    {metadata.whyExamNeededInSpace}
                  </p>
                  <a
                    href={metadata.nasaHrpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-white underline-offset-2 hover:underline"
                  >
                    <span>{metadata.nasaHrpRiskTitle}</span>
                    <ExternalLink className="h-3 w-3 text-[#71717a]" />
                  </a>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {metadata.primaryHazards.map((hazardId) => {
                      const hazard = NASA_HAZARDS[hazardId];
                      return (
                        <a
                          key={hazardId}
                          href={hazard.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-white/[0.07] bg-[#161618] px-2 py-0.5 text-[10.5px] text-[#a1a1aa] hover:border-white/20 hover:text-white"
                        >
                          HRP · {hazard.shortLabel}
                        </a>
                      );
                    })}
                    {metadata.osdrStudyIds.map((studyId) => (
                      <a
                        key={studyId}
                        href={`https://osdr.nasa.gov/bio/repo/data/studies/${studyId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-[#161618] px-2 py-0.5 font-mono text-[10.5px] text-white hover:border-white/20"
                      >
                        OSDR {studyId}
                        <ExternalLink className="h-2.5 w-2.5 text-[#71717a]" />
                      </a>
                    ))}
                  </div>
                  {metadata.partnerReference && (
                    <p className="text-[11px] text-[#71717a]">
                      {metadata.partnerReference}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Stage 1 Primary Actions */}
            <div className="grid grid-cols-1 gap-2 pt-0.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStage("exam")}
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#e4e4e7] active:scale-[0.99]"
              >
                <span>Start Guided Exam</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setStage("intervene")}
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-[#161618] px-3.5 py-2 text-xs font-medium text-white transition hover:border-white/25 hover:bg-[#1c1c1f]"
              >
                <span>Countermeasures</span>
              </button>
            </div>
          </div>
        )}

        {stage === "exam" && currentStep && (
          <div className="flex flex-col gap-3">
            {/* Step Progress Bar & Reset */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {steps.map((s, idx) => {
                  const key = `${selectedSystem}-${s.stepNumber}`;
                  const finding = examFindings[key];
                  const isActive = idx === activeStepIdx;
                  const statusColor =
                    finding?.status === "normal"
                      ? "bg-emerald-400"
                      : finding?.status === "escalated"
                      ? "bg-rose-400"
                      : "bg-[#52525b]";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveStepIdx(idx)}
                      className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                        isActive
                          ? "border-white/25 bg-[#1e1e22] text-white"
                          : "border-white/[0.06] bg-[#151517] text-[#71717a] hover:text-white"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                      <span>Step {s.stepNumber}</span>
                    </button>
                  );
                })}
              </div>

              {verifiedCount > 0 && (
                <button
                  type="button"
                  onClick={resetCurrentExam}
                  className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-lg border border-white/[0.07] bg-[#151517] px-2.5 py-1 text-[11px] text-[#a1a1aa] hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Reset
                </button>
              )}
            </div>

            {/* Active Exam Step Card */}
            {(() => {
              const stepKey = `${selectedSystem}-${currentStep.stepNumber}`;
              const finding = examFindings[stepKey];
              const isNormal = finding?.status === "normal";
              const isEscalated = finding?.status === "escalated";

              return (
                <div
                  data-testid="active-exam-step-card"
                  className="rounded-2xl border border-white/[0.07] bg-[#151517] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#71717a]">
                        Step {currentStep.stepNumber} of {steps.length}
                      </span>
                      <h3 className="mt-0.5 text-sm font-semibold text-white">
                        {currentStep.title}
                      </h3>
                    </div>
                    {finding && finding.status !== "pending" && (
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                          isNormal
                            ? "border-emerald-500/25 bg-[#121614] text-emerald-300"
                            : "border-rose-500/30 bg-[#191113] text-rose-300"
                        }`}
                      >
                        {isNormal ? "Logged Normal" : "Escalated"}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">
                    {currentStep.instruction}
                  </p>

                  {/* Interactive System Diagnostics */}
                  {selectedSystem === "neuro_ocular" &&
                    currentStep.stepNumber === 1 && (
                      <InteractiveAmslerGrid
                        finding={vitals.ocularFinding}
                        onSelect={(next) => {
                          onOcularFindingChange?.(next);
                          logCurrentStep(
                            next === "clear" ? "normal" : "escalated",
                            next === "clear"
                              ? "Amsler Clear"
                              : next === "blurry_near"
                              ? "Near Blur"
                              : "Wavy / Halos",
                            undefined,
                            false
                          );
                        }}
                      />
                    )}

                  {selectedSystem === "neuro_ocular" &&
                    currentStep.stepNumber === 2 && (
                      <InteractiveOnsdCaliper
                        measuredValue={finding?.measuredValue}
                        onSelect={(mmLabel, escalated) => {
                          logCurrentStep(
                            escalated ? "escalated" : "normal",
                            mmLabel,
                            escalated
                              ? `ONSD measured ${mmLabel} (> 5.0 mm cutoff)`
                              : `ONSD measured ${mmLabel} (within <= 5.0 mm cutoff)`,
                            false
                          );
                        }}
                      />
                    )}

                  <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] border-l-2 border-l-emerald-400/75 bg-[#111113] p-2.5">
                      <span className="block font-mono text-[9.5px] uppercase tracking-wider text-emerald-300">
                        Space Normal
                      </span>
                      <span className="mt-1 block leading-snug text-[#d4d4d8]">
                        {currentStep.normalObservation}
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] border-l-2 border-l-rose-400/75 bg-[#111113] p-2.5">
                      <span className="block font-mono text-[9.5px] uppercase tracking-wider text-rose-300">
                        Escalate If
                      </span>
                      <span className="mt-1 block leading-snug text-[#d4d4d8]">
                        {currentStep.escalationTrigger}
                      </span>
                    </div>
                  </div>

                  {/* Verification Action Buttons */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => logCurrentStep("normal")}
                      className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white px-3 py-2 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#e4e4e7] active:scale-[0.98]"
                    >
                      <span>Log Space-Normal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => logCurrentStep("escalated")}
                      className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-[#191113] px-3 py-2 text-xs font-medium text-rose-200 transition hover:border-rose-400/60 hover:bg-[#221518] active:scale-[0.98]"
                    >
                      <span>Flag Escalation</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Wizard Navigation Footer */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={activeStepIdx === 0}
                onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
                className="inline-flex min-h-[38px] cursor-pointer items-center gap-1 rounded-xl border border-white/[0.08] bg-[#151517] px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Prev</span>
              </button>

              {activeStepIdx < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveStepIdx((i) => Math.min(steps.length - 1, i + 1))
                  }
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1 rounded-xl border border-white/15 bg-[#1c1c1f] px-4 py-1.5 text-xs font-medium text-white transition hover:border-white/30"
                >
                  <span>Next Step</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage("intervene")}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#e4e4e7]"
                >
                  <span>Countermeasures</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "intervene" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#71717a]">
                Countermeasures · {metadata.shortLabel.split(" / ")[0]}
              </span>
              <span className="font-mono text-[10px] text-[#a1a1aa]">
                BioTwin Live
              </span>
            </div>

            <div className="space-y-2.5">
              {systemCountermeasures.map((spec) => {
                const lastRun = [...executedActions]
                  .reverse()
                  .find((a) => a.actionId === spec.id);
                const prediction = crewProfile
                  ? simulatePersonalizedDrugResponse(
                      crewProfile,
                      spec,
                      vitals,
                      envTelemetry
                    )
                  : null;
                const isContra =
                  prediction?.contraindicationSeverity === "contraindicated";
                const isCaution =
                  prediction?.contraindicationSeverity === "caution";

                return (
                  <div
                    key={spec.id}
                    className={`rounded-2xl border p-3.5 transition ${
                      isContra
                        ? "border-rose-500/40 bg-[#171113]"
                        : lastRun
                        ? "border-emerald-500/30 bg-[#121614]"
                        : "border-white/[0.06] bg-[#151517]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md border border-white/[0.08] bg-[#0d0d0f] px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {spec.protocolCode}
                      </span>
                      <span className="truncate font-mono text-[10px] text-[#71717a]">
                        {spec.hardwareTarget}
                      </span>
                    </div>

                    <h3 className="mt-2 text-xs font-semibold leading-snug text-white">
                      {spec.label}
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-[#a1a1aa]">
                      {spec.deltaSummary}
                    </p>

                    {prediction && (
                      <div
                        data-testid={`pkpd-prediction-${spec.id}`}
                        className={`mt-2.5 rounded-xl border border-white/[0.06] border-l-2 bg-[#0e0e10] px-2.5 py-2 text-[10.5px] ${
                          isContra
                            ? "border-l-rose-400 text-rose-100"
                            : isCaution
                            ? "border-l-amber-400 text-[#e4e4e7]"
                            : "border-l-emerald-400/75 text-[#d4d4d8]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[10px]">
                          <span className="font-semibold text-white tabular-nums">
                            {prediction.basis === "phenotype_scaling"
                              ? "CYP Scaling Est."
                              : "Rule-Based Est."} · {prediction.efficacyPct}%
                            {prediction.clearanceHalfLifeHours > 0
                              ? ` · t1/2 ${prediction.clearanceHalfLifeHours}h`
                              : ""}
                          </span>
                          <span
                            className={
                              isContra
                                ? "font-semibold text-rose-300"
                                : isCaution
                                ? "font-semibold text-amber-300"
                                : "text-emerald-300"
                            }
                          >
                            {isContra
                              ? "CONTRAINDICATED"
                              : isCaution
                              ? "DOSE CAUTION"
                              : "PROFILE SAFE"}
                          </span>
                        </div>
                        {/* Precision Efficacy Meter */}
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                          <div
                            className={`h-full rounded-full ${
                              isContra
                                ? "bg-rose-400"
                                : isCaution
                                ? "bg-amber-400"
                                : "bg-emerald-400/80"
                            }`}
                            style={{
                              width: `${Math.max(5, Math.min(100, prediction.efficacyPct))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 font-medium text-white/90">
                          {prediction.recommendedDoseAdjustment}
                        </p>
                        <p className="mt-1 leading-snug text-[#a1a1aa]">
                          {prediction.mechanisticRationale}
                        </p>
                        {prediction.contraindicationWarning && (
                          <p
                            data-testid={
                              isContra ? "rx-contraindication-alert" : undefined
                            }
                            className="mt-1 leading-snug text-[#d4d4d8]"
                          >
                            {prediction.contraindicationWarning}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {lastRun ? (
                        <span className="font-mono text-[10px] font-medium text-emerald-300">
                          EXECUTED · {lastRun.timestamp}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-[#71717a]">
                          {isContra
                            ? "Contraindicated — Sim reveals collision"
                            : "Ready for execution"}
                        </span>
                      )}

                      <button
                        type="button"
                        data-testid={`execute-protocol-${spec.id}`}
                        onClick={() => onExecuteCountermeasure?.(spec)}
                        className={`inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                          isContra
                            ? "border border-rose-400/45 bg-[#221417] text-rose-200 hover:bg-[#2c191d]"
                            : lastRun
                            ? "border border-white/15 bg-[#1b1b1e] text-white hover:border-white/30"
                            : "bg-white text-[#0a0a0a] hover:bg-[#e4e4e7]"
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                        <span>
                          {isContra
                            ? "Sim Adverse Impact"
                            : lastRun
                            ? "Re-Execute"
                            : "Execute Protocol"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Escalation Criteria */}
            <div className="rounded-xl border border-white/[0.06] bg-[#151517] p-3 text-[11px] text-[#a1a1aa]">
              <strong className="font-medium text-white">
                Houston Escalation Trigger —{" "}
              </strong>
              {metadata.flightSurgeonCriteria}
            </div>

            {/* Session Execution Audit Log */}
            {executedActions.length > 0 && (
              <div
                data-testid="executed-protocol-log"
                className="rounded-2xl border border-white/[0.06] bg-[#0b0b0d] p-3"
              >
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#71717a]">
                  Executed Protocol Log ({executedActions.length})
                </span>
                <ul className="mt-2 space-y-1.5">
                  {[...executedActions].reverse().slice(0, 4).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 text-[11px]"
                    >
                      <span className="text-[#e4e4e7]">{item.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-[#71717a]">
                        {item.timestamp}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStage("downlink")}
              className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-[#151517] px-4 py-2 text-xs font-medium text-white transition hover:border-white/25"
            >
              <span>Review Flight Surgeon Packet</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {stage === "downlink" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#151517] p-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    evaluation.flightSurgeonAlertRequired
                      ? "bg-rose-400"
                      : "bg-emerald-400"
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold text-white">
                    {evaluation.flightSurgeonAlertRequired
                      ? "Priority DTN Escalation Packet"
                      : "Asynchronous Flight Surgeon Packet"}
                  </p>
                  <p className="text-[10.5px] text-[#71717a]">
                    Includes live vitals, verified self-exams &amp; executed
                    countermeasures
                  </p>
                </div>
              </div>
              {queuedAt && (
                <span
                  data-testid="dtn-queued-badge"
                  className="shrink-0 rounded-md border border-emerald-500/25 bg-[#121614] px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300"
                >
                  QUEUED · {queuedAt}
                </span>
              )}
            </div>

            <pre
              data-testid="dtn-packet-preview"
              className="max-h-[300px] overflow-auto rounded-xl border border-white/[0.06] bg-[#09090b] p-3 font-mono text-[10.5px] leading-relaxed text-[#a1a1aa]"
            >
              {packetText}
            </pre>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCopyPacket}
                className={`inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  copied
                    ? "border-emerald-500/40 bg-[#121614] text-emerald-200"
                    : "border-white/[0.09] bg-[#151517] text-white hover:border-white/25"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copied Packet</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy Packet</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="queue-houston-btn"
                onClick={handleQueueTelemetry}
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#e4e4e7] active:scale-[0.98]"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {queuedAt ? "Re-Queue to Houston" : "Queue Telemetry to Houston"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

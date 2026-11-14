"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crosshair,
  ExternalLink,
  Play,
  Radio,
  RotateCcw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  BODY_SYSTEM_METADATA,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import { formatFlightSurgeonPacket } from "@/lib/triageEngine";
import type {
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
}

const STATUS_BADGE_MAP: Record<
  TriageStatus,
  { label: string; className: string; dotClass: string }
> = {
  green: {
    label: "NOMINAL",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  amber: {
    label: "ELEVATED",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    dotClass: "bg-amber-400",
  },
  red: {
    label: "CRITICAL",
    className: "border-rose-500/30 bg-rose-500/15 text-rose-300",
    dotClass: "bg-rose-400",
  },
};

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
      className="mt-2.5 rounded-xl border border-white/[0.08] bg-[#0b0d12] p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#050608] p-2">
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
                  : "rgba(45,212,191,0.65)"
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
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#8b909a]">
              Interactive Amsler Check
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                finding === "clear"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : finding === "blurry_near"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {finding === "clear"
                ? "Crisp"
                : finding === "blurry_near"
                ? "Near Blur"
                : "Wavy / Halos"}
            </span>
          </div>
          <p className="text-[11px] leading-snug text-[#7e828a]">
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
                  className={`min-h-[38px] cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? val === "clear"
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                        : val === "blurry_near"
                        ? "border-amber-400 bg-amber-500/20 text-amber-200"
                        : "border-rose-400 bg-rose-500/20 text-rose-200"
                      : "border-white/10 bg-[#16181f] text-[#9ea3ae] hover:border-white/25 hover:text-white"
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
      className="mt-2.5 rounded-xl border border-white/[0.08] bg-[#0b0d12] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#8b909a]">
          Ocular Ultrasound ONSD Caliper (3 mm retrobulbar)
        </span>
        {measuredValue && (
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
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
                  ? p.escalated
                    ? "border-rose-400 bg-rose-500/20 text-rose-200"
                    : "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                  : "border-white/10 bg-[#16181f] text-[#9ea3ae] hover:border-white/25 hover:text-white"
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
}: AutonomousCmoPanelProps) {
  const [stage, setStage] = useState<CmoWorkflowStage>("overview");
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);
  const [internalExamFindings, setInternalExamFindings] = useState<
    Record<string, ExamStepFinding>
  >({});
  const [copied, setCopied] = useState<boolean>(false);
  const [queuedAt, setQueuedAt] = useState<string | null>(null);

  useEffect(() => {
    setActiveStepIdx(0);
    setStage("overview");
  }, [selectedSystem]);

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
  const badge = STATUS_BADGE_MAP[assessment.status];
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
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#141414]"
    >
      {/* Top Pinned Clinical Header + 4-Stage Segmented Tabs */}
      <div className="shrink-0 border-b border-white/[0.07] bg-[#141414] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
              isAutonomousMode
                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isAutonomousMode ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            {isAutonomousMode
              ? `Autonomous CMO · ${envConfig.commDelayLabel}`
              : `Flight Link Live · ${envConfig.commDelayLabel}`}
          </span>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider ${badge.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
              {badge.label}
            </span>
            <span className="font-mono text-xs tabular-nums text-[#7e828a]">
              <strong className="text-sm font-semibold text-white">
                {assessment.score}
              </strong>
              /100
            </span>
          </div>
        </div>

        <div className="mt-2">
          <h2 className="truncate text-lg font-semibold tracking-tight text-white">
            {metadata.name}
          </h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-[#7e828a]">
            {metadata.organSummary}
          </p>
        </div>

        {/* 4-Stage Segmented Action Deck Selector */}
        <div
          role="tablist"
          aria-label="CMO workflow stages"
          className="mt-3 grid grid-cols-4 gap-1 rounded-xl border border-white/[0.08] bg-[#0b0d12] p-1"
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
                className={`min-h-[38px] cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? "bg-white text-[#0a0a0a] shadow-sm"
                    : "text-[#8b909a] hover:bg-white/[0.05] hover:text-white"
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
          <div className="flex flex-col gap-3">
            {pinnedSub && (
              <div
                data-testid="pinned-substructure-card"
                className="flex items-center justify-between gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.08] px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Crosshair
                    className="h-3.5 w-3.5 shrink-0 text-cyan-300"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      Pinned: {pinnedSub.displayLabel}
                    </p>
                    <p className="truncate font-mono text-[10px] text-cyan-200/80">
                      {pinnedSub.layer} · {pinnedSub.tissueTag}
                    </p>
                  </div>
                </div>
                {onClearSubStructure && (
                  <button
                    type="button"
                    onClick={onClearSubStructure}
                    aria-label="Clear pinned 3D sub-structure"
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-cyan-200/70 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {isAutonomousMode && (
              <div
                role="status"
                className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 text-xs"
              >
                <div className="flex items-center gap-1.5 font-medium text-amber-300">
                  <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Deep-Space Autonomous Protocol Required
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#9ea3ae]">
                  Round-trip link exceeds clinical action window. Complete Guided
                  Self-Exam and Countermeasures before Houston downlink.
                </p>
              </div>
            )}

            {/* Live Clinical Findings & Cascade State */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b1b] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
                  Live Findings
                </span>
                <span className="font-mono text-[10.5px] font-medium text-white">
                  {assessment.headline}
                </span>
              </div>

              <ul className="mt-2.5 space-y-2">
                {assessment.findings.map((finding, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-white"
                  >
                    {assessment.status === "green" ? (
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          assessment.status === "red"
                            ? "text-rose-400"
                            : "text-amber-400"
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="leading-snug">{finding}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#141414] px-3 py-2 text-[11px] text-[#9ea3ae]">
                <strong className="font-medium text-white">
                  Space Baseline Shift:{" "}
                </strong>
                {assessment.earthVsSpaceNote}
              </div>
            </div>

            {/* Collapsible NASA HRP & OSDR Evidence Accordion */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b1b]">
              <button
                type="button"
                onClick={() => setShowEvidence((prev) => !prev)}
                aria-expanded={showEvidence}
                className="flex min-h-[42px] w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-white transition hover:bg-white/[0.03]"
              >
                <span>NASA HRP Risk &amp; OSDR Scientific Rationale</span>
                {showEvidence ? (
                  <ChevronUp
                    className="h-4 w-4 shrink-0 text-[#7e828a]"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-[#7e828a]"
                    aria-hidden="true"
                  />
                )}
              </button>

              {showEvidence && (
                <div className="space-y-2.5 border-t border-white/[0.07] px-3.5 py-3 text-xs">
                  <p className="leading-relaxed text-[#9ea3ae]">
                    {metadata.whyExamNeededInSpace}
                  </p>
                  <a
                    href={metadata.nasaHrpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-white underline-offset-2 hover:underline"
                  >
                    <span>{metadata.nasaHrpRiskTitle}</span>
                    <ExternalLink className="h-3 w-3 text-[#7e828a]" />
                  </a>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {metadata.primaryHazards.map((hazardId) => {
                      const hazard = NASA_HAZARDS[hazardId];
                      return (
                        <a
                          key={hazardId}
                          href={hazard.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-[#141414] px-2.5 py-0.5 text-[10.5px] text-[#9ea3ae] hover:border-white/25 hover:text-white"
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
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#141414] px-2.5 py-0.5 font-mono text-[10.5px] text-white hover:border-white/25"
                      >
                        OSDR {studyId}
                        <ExternalLink className="h-2.5 w-2.5 text-[#7e828a]" />
                      </a>
                    ))}
                  </div>
                  {metadata.partnerReference && (
                    <p className="text-[11px] text-[#7e828a]">
                      {metadata.partnerReference}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Stage 1 Primary Actions */}
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStage("exam")}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#f5f4f0] active:scale-[0.99]"
              >
                <span>Start Guided Self-Exam</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setStage("intervene")}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1b1b1b] px-4 py-2 text-xs font-medium text-white transition hover:border-white/30 hover:bg-[#222222]"
              >
                <Activity className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                <span>Execute Countermeasures</span>
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
                      : "bg-[#565b66]";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveStepIdx(idx)}
                      className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                        isActive
                          ? "border-white/30 bg-white/10 text-white"
                          : "border-white/[0.07] bg-[#1b1b1b] text-[#7e828a] hover:text-white"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                      <span>Step {s.stepNumber}</span>
                    </button>
                  );
                })}
              </div>

              {verifiedCount > 0 && (
                <button
                  type="button"
                  onClick={resetCurrentExam}
                  className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-[#1b1b1b] px-2.5 py-1 text-[11px] text-[#9ea3ae] hover:text-white"
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
                  className={`rounded-2xl border p-3.5 ${
                    isNormal
                      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                      : isEscalated
                      ? "border-rose-500/30 bg-rose-500/[0.06]"
                      : "border-white/[0.08] bg-[#1b1b1b]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#7e828a]">
                        Step {currentStep.stepNumber} of {steps.length}
                      </span>
                      <h3 className="mt-0.5 text-sm font-semibold text-white">
                        {currentStep.title}
                      </h3>
                    </div>
                    {finding && finding.status !== "pending" && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          isNormal
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {isNormal ? "Logged Normal" : "Escalated"}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#b4b9c4]">
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
                    <div className="rounded-xl border border-emerald-500/15 bg-[#121614] p-2.5 text-emerald-200/90">
                      <strong className="block font-medium text-emerald-300">
                        Space Normal
                      </strong>
                      <span className="mt-0.5 block leading-snug text-emerald-100/80">
                        {currentStep.normalObservation}
                      </span>
                    </div>
                    <div className="rounded-xl border border-rose-500/15 bg-[#191214] p-2.5 text-rose-200/90">
                      <strong className="block font-medium text-rose-300">
                        Escalate If
                      </strong>
                      <span className="mt-0.5 block leading-snug text-rose-100/80">
                        {currentStep.escalationTrigger}
                      </span>
                    </div>
                  </div>

                  {/* Glove-Friendly Verification Action Buttons */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => logCurrentStep("normal")}
                      className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 active:scale-[0.98]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Log Space-Normal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => logCurrentStep("escalated")}
                      className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 active:scale-[0.98]"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-1.5 text-xs font-medium text-white transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl border border-white/15 bg-[#202020] px-4 py-1.5 text-xs font-medium text-white transition hover:border-white/30"
                >
                  <span>Next Step</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStage("intervene")}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#f5f4f0]"
                >
                  <span>Proceed to Countermeasures</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "intervene" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
                Closed-Loop Countermeasures · {metadata.shortLabel.split(" / ")[0]}
              </span>
              <span className="font-mono text-[10.5px] text-cyan-300">
                Updates BioTwin Live
              </span>
            </div>

            <div className="space-y-2.5">
              {systemCountermeasures.map((spec) => {
                const lastRun = [...executedActions]
                  .reverse()
                  .find((a) => a.actionId === spec.id);

                return (
                  <div
                    key={spec.id}
                    className={`rounded-2xl border p-3.5 transition ${
                      lastRun
                        ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                        : "border-white/[0.08] bg-[#1b1b1b]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded border border-white/10 bg-[#141414] px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {spec.protocolCode}
                      </span>
                      <span className="truncate font-mono text-[10px] text-[#7e828a]">
                        {spec.hardwareTarget}
                      </span>
                    </div>

                    <h3 className="mt-2 text-xs font-semibold leading-snug text-white">
                      {spec.label}
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-cyan-200/80">
                      {spec.deltaSummary}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {lastRun ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          EXECUTED · {lastRun.timestamp}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-[#7e828a]">
                          Ready for crew execution
                        </span>
                      )}

                      <button
                        type="button"
                        data-testid={`execute-protocol-${spec.id}`}
                        onClick={() => onExecuteCountermeasure?.(spec)}
                        className={`inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                          lastRun
                            ? "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                            : "bg-white text-[#0a0a0a] hover:bg-[#f5f4f0]"
                        }`}
                      >
                        <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                        <span>{lastRun ? "Re-Execute" : "Execute Protocol"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Escalation Criteria */}
            <div className="rounded-xl border border-white/[0.07] bg-[#1b1b1b] p-3 text-[11px] text-[#9ea3ae]">
              <strong className="font-medium text-white">
                Houston Escalation Trigger:{" "}
              </strong>
              {metadata.flightSurgeonCriteria}
            </div>

            {/* Session Execution Audit Log */}
            {executedActions.length > 0 && (
              <div
                data-testid="executed-protocol-log"
                className="rounded-2xl border border-white/[0.07] bg-[#0b0d12] p-3"
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-[#7e828a]">
                  Executed Protocol Log ({executedActions.length})
                </span>
                <ul className="mt-2 space-y-1.5">
                  {[...executedActions].reverse().slice(0, 4).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 text-[11px]"
                    >
                      <span className="text-emerald-200">{item.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-[#7e828a]">
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
              className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1b1b1b] px-4 py-2 text-xs font-medium text-white transition hover:border-white/30"
            >
              <span>Review Flight Surgeon Packet</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {stage === "downlink" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#1b1b1b] p-3">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`h-4 w-4 shrink-0 ${
                    evaluation.flightSurgeonAlertRequired
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold text-white">
                    {evaluation.flightSurgeonAlertRequired
                      ? "Priority DTN Escalation Packet"
                      : "Asynchronous Flight Surgeon Packet"}
                  </p>
                  <p className="text-[10.5px] text-[#7e828a]">
                    Includes live vitals, verified self-exams &amp; executed
                    countermeasures
                  </p>
                </div>
              </div>
              {queuedAt && (
                <span
                  data-testid="dtn-queued-badge"
                  className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300"
                >
                  QUEUED · {queuedAt}
                </span>
              )}
            </div>

            <pre
              data-testid="dtn-packet-preview"
              className="max-h-[300px] overflow-auto rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-3 font-mono text-[10.5px] leading-relaxed text-[#b4b9c4]"
            >
              {packetText}
            </pre>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCopyPacket}
                className={`inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  copied
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-white/15 bg-[#1b1b1b] text-white hover:border-white/30"
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
                className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#f5f4f0] active:scale-[0.98]"
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

"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Radio,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  BODY_SYSTEM_METADATA,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import { formatFlightSurgeonPacket } from "@/lib/triageEngine";
import type {
  BodySystemId,
  EnvironmentTelemetry,
  HealthEvaluationResult,
  MissionEnvironmentId,
  TriageStatus,
  VitalReadings,
} from "@/types/health";

export interface AutonomousCmoPanelProps {
  selectedSystem: BodySystemId;
  evaluation: HealthEvaluationResult;
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
  envId: MissionEnvironmentId;
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

export function AutonomousCmoPanel({
  selectedSystem,
  evaluation,
  vitals,
  envTelemetry,
  envId,
}: AutonomousCmoPanelProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [showPacket, setShowPacket] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const metadata = BODY_SYSTEM_METADATA[selectedSystem];
  const assessment = evaluation.systems[selectedSystem];
  const envConfig = MISSION_ENVIRONMENTS[envId];
  const badge = STATUS_BADGE_MAP[assessment.status];
  const isAutonomousMode =
    envConfig.autonomousModeRequired || evaluation.autonomousTriageRequired;

  const completedCount = metadata.selfExamSteps.filter(
    (step) => checkedSteps[`${selectedSystem}-${step.stepNumber}`]
  ).length;

  const packetText = formatFlightSurgeonPacket(
    evaluation,
    vitals,
    envTelemetry,
    envId
  );

  function toggleExamStep(stepNumber: number) {
    const key = `${selectedSystem}-${stepNumber}`;
    setCheckedSteps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function resetCurrentExam() {
    setCheckedSteps((prev) => {
      const next = { ...prev };
      for (const step of metadata.selfExamSteps) {
        delete next[`${selectedSystem}-${step.stepNumber}`];
      }
      return next;
    });
  }

  async function handleCopyPacket() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(packetText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPacket(true);
    }
  }

  return (
    <section
      aria-label="Autonomous Chief Medical Officer Triage Panel"
      className="flex flex-col gap-4 border-t border-white/[0.07] bg-[#141414] p-5 sm:p-6 lg:h-[740px] lg:overflow-y-auto lg:border-t-0 lg:border-l"
    >
      {/* Top Status & System Header */}
      <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-4">
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
              ? `Autonomous CMO Active · ${envConfig.commDelayLabel}`
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
              <strong className="font-semibold text-white">
                {assessment.score}
              </strong>
              /100
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-medium tracking-tight text-white">
            {metadata.name}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#7e828a]">
            {metadata.organSummary}
          </p>
        </div>
      </div>

      {/* Autonomous Deep-Space Mode Notice */}
      {isAutonomousMode && (
        <div
          role="status"
          className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-xs"
        >
          <div className="flex items-center gap-1.5 font-medium text-amber-300">
            <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Deep-Space Autonomous Protocol Required
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#7e828a]">
            Round-trip ground confirmation exceeds clinical action windows.
            Complete the 3-step CMO self-exam and execute countermeasures before
            queuing telemetry for Houston Flight Surgeons.
          </p>
        </div>
      )}

      {/* NASA HRP Risk & OSDR Citation Pills */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b1b] p-3.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
          NASA HRP Risk Classification
        </span>
        <a
          href={metadata.nasaHrpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white transition hover:text-[#7e828a]"
        >
          <span>{metadata.nasaHrpRiskTitle}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-[#7e828a]" aria-hidden="true" />
        </a>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {metadata.primaryHazards.map((hazardId) => {
            const hazard = NASA_HAZARDS[hazardId];
            return (
              <a
                key={hazardId}
                href={hazard.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={hazard.description}
                className="rounded-full border border-white/10 bg-[#202020] px-3 py-1 text-[11px] font-medium text-[#7e828a] transition hover:border-white/25 hover:text-white"
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
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#202020] px-3 py-1 font-mono text-[11px] font-medium text-white transition hover:border-white/25 hover:bg-[#2b2b2b]"
            >
              <span>OSDR {studyId}</span>
              <ExternalLink className="h-2.5 w-2.5 text-[#7e828a]" aria-hidden="true" />
            </a>
          ))}
        </div>

        {metadata.partnerReference && (
          <p className="mt-2 text-[11px] text-[#7e828a]">
            {metadata.partnerReference}
          </p>
        )}
      </div>

      {/* Clinical Rationale + Baseline Shift + Findings */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b1b] p-3.5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
          Why This Exam Matters in Spaceflight
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[#7e828a]">
          {metadata.whyExamNeededInSpace}
        </p>

        <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-[#141414] px-3 py-2 text-[11px] text-[#7e828a]">
          <strong className="font-medium text-white">Baseline Shift: </strong>
          {assessment.earthVsSpaceNote}
        </div>

        {assessment.findings.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              Live Findings · {assessment.headline}
            </span>
            <ul className="space-y-1">
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
          </div>
        )}
      </div>

      {/* 3-Step Guided CMO Self-Exam */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b1b] p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-white">
              3-Step Guided CMO Self-Exam
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-[#7e828a]">
              {completedCount} of {metadata.selfExamSteps.length} steps verified
            </p>
          </div>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={resetCurrentExam}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#202020] px-2.5 py-1 text-[11px] font-medium text-white transition hover:border-white/25 hover:bg-[#2b2b2b]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        <div className="space-y-2">
          {metadata.selfExamSteps.map((step) => {
            const key = `${selectedSystem}-${step.stepNumber}`;
            const isChecked = Boolean(checkedSteps[key]);
            return (
              <div
                key={key}
                className={`rounded-xl border p-3 transition ${
                  isChecked
                    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                    : "border-white/[0.07] bg-[#141414]"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleExamStep(step.stepNumber)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-[#202020] accent-white"
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-xs font-medium ${
                        isChecked
                          ? "text-emerald-300 line-through"
                          : "text-white"
                      }`}
                    >
                      Step {step.stepNumber}: {step.title}
                    </span>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#7e828a]">
                      {step.instruction}
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 text-[10px] sm:grid-cols-2">
                      <div className="rounded-lg bg-[#1b1b1b] px-2.5 py-1.5 text-emerald-300/90">
                        <strong className="font-medium text-emerald-200">
                          Space Normal:{" "}
                        </strong>
                        {step.normalObservation}
                      </div>
                      <div className="rounded-lg bg-[#1b1b1b] px-2.5 py-1.5 text-rose-300/90">
                        <strong className="font-medium text-rose-200">
                          Escalate If:{" "}
                        </strong>
                        {step.escalationTrigger}
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Immediate Crew Countermeasures */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b1b] p-3.5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-white">
          Immediate Crew Countermeasures
        </h3>
        <ul className="mt-2 space-y-1.5">
          {assessment.recommendedActions.map((action, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-xs leading-relaxed text-[#7e828a]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
              <span className="text-white/90">{action}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-[11px] text-[#7e828a]">
          <strong className="font-medium text-white">
            Escalation Criteria:{" "}
          </strong>
          {metadata.flightSurgeonCriteria}
        </p>
      </div>

      {/* Flight Surgeon Telemetry Packet */}
      <div className="mt-auto rounded-2xl border border-white/[0.07] bg-[#1b1b1b] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert
              className={`h-4 w-4 ${
                evaluation.flightSurgeonAlertRequired
                  ? "text-rose-400"
                  : "text-white"
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-white">
              {evaluation.flightSurgeonAlertRequired
                ? "Flight Surgeon Escalation Packet"
                : "Telemetry Downlink Packet"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPacket((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#202020] px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-[#2b2b2b]"
            >
              <FileText className="h-3.5 w-3.5 text-[#7e828a]" aria-hidden="true" />
              {showPacket ? "Hide Packet" : "Preview Packet"}
            </button>

            <button
              type="button"
              onClick={handleCopyPacket}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition active:scale-[0.98] ${
                copied
                  ? "bg-emerald-400 text-[#0a0a0a]"
                  : "bg-white text-[#0a0a0a] hover:bg-[#f5f4f0]"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Copied Packet
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy Flight Surgeon Packet
                </>
              )}
            </button>
          </div>
        </div>

        {showPacket && (
          <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-3 font-mono text-[11px] leading-relaxed text-[#7e828a]">
            {packetText}
          </pre>
        )}
      </div>
    </section>
  );
}

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
  Stethoscope,
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
  { label: string; className: string }
> = {
  green: {
    label: "NOMINAL",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  amber: {
    label: "ELEVATED",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  red: {
    label: "CRITICAL",
    className: "border-rose-500/40 bg-rose-500/15 text-rose-300",
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
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg"
    >
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/90 pb-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
            Autonomous CMO Triage
          </p>
          <h2 className="mt-0.5 text-base font-bold text-slate-100">
            {metadata.name}
          </h2>
          <p className="text-xs text-slate-400">{metadata.organSummary}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="font-mono text-xs text-slate-300">
            Score:{" "}
            <strong className="text-slate-100">{assessment.score}</strong>/100
          </span>
        </div>
      </div>

      {/* Comm Delay / Autonomous Mode Warning Banner */}
      {isAutonomousMode && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-950/35 p-2.5 text-xs text-amber-100"
        >
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Autonomous Deep-Space Mode · Delay {envConfig.commDelayLabel}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-200/90">
            Round-trip ground confirmation exceeds real-time clinical windows.
            Complete the 3-step CMO self-exam and execute countermeasures before
            queuing telemetry for Houston Flight Surgeons.
          </p>
        </div>
      )}

      {/* NASA HRP Risk Title, Primary Hazards & OSDR Study Badges */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active NASA HRP Risk Classification
            </span>
            <a
              href={metadata.nasaHrpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline"
            >
              <span>{metadata.nasaHrpRiskTitle}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {metadata.primaryHazards.map((hazardId) => {
            const hazard = NASA_HAZARDS[hazardId];
            return (
              <a
                key={hazardId}
                href={hazard.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={hazard.description}
                className="rounded border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-200"
              >
                HRP: {hazard.shortLabel}
              </a>
            );
          })}
          {metadata.osdrStudyIds.map((studyId) => (
            <a
              key={studyId}
              href={`https://osdr.nasa.gov/bio/repo/data/studies/${studyId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-cyan-500/35 bg-cyan-950/50 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-900/60"
            >
              <span>OSDR {studyId}</span>
              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            </a>
          ))}
        </div>

        {metadata.partnerReference && (
          <p className="mt-2 text-[10px] text-slate-400">
            Partner Reference: {metadata.partnerReference}
          </p>
        )}
      </div>

      {/* Why This Exam Is Needed in Space + Earth vs Space Note + Live Findings */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Why This Exam Matters in Spaceflight
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {metadata.whyExamNeededInSpace}
        </p>
        <p className="mt-2 rounded border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-[11px] text-cyan-200/90">
          <strong className="font-semibold text-cyan-300">
            Baseline Shift:
          </strong>{" "}
          {assessment.earthVsSpaceNote}
        </p>

        {assessment.findings.length > 0 && (
          <div className="mt-2 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Live Telemetry Findings ({assessment.headline})
            </span>
            <ul className="space-y-1">
              {assessment.findings.map((finding, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-1.5 text-xs text-slate-200"
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
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Interactive 3-Step Guided Self-Exam Protocol */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              3-Step Guided CMO Self-Exam
            </h3>
            <p className="text-[11px] text-slate-400">
              {completedCount} of {metadata.selfExamSteps.length} verification
              steps completed
            </p>
          </div>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={resetCurrentExam}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
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
                className={`rounded-lg border p-2.5 transition ${
                  isChecked
                    ? "border-emerald-500/45 bg-emerald-950/25"
                    : "border-slate-800 bg-slate-900/70"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleExamStep(step.stepNumber)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-950 text-cyan-400 accent-cyan-400"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          isChecked ? "text-emerald-200" : "text-slate-100"
                        }`}
                      >
                        Step {step.stepNumber}: {step.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                      {step.instruction}
                    </p>
                    <div className="mt-1.5 grid grid-cols-1 gap-1 text-[10px] sm:grid-cols-2">
                      <div className="rounded bg-slate-950/70 px-2 py-1 text-emerald-300/90">
                        <strong>Space Normal:</strong> {step.normalObservation}
                      </div>
                      <div className="rounded bg-slate-950/70 px-2 py-1 text-rose-300/90">
                        <strong>Escalate If:</strong> {step.escalationTrigger}
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
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
          Immediate Crew Countermeasures
        </h3>
        <ul className="mt-1.5 space-y-1.5">
          {assessment.recommendedActions.map((action, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-xs leading-relaxed text-slate-200"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
          <strong className="text-slate-300">Escalation Criteria:</strong>{" "}
          {metadata.flightSurgeonCriteria}
        </p>
      </div>

      {/* Flight Surgeon Escalation / Telemetry Packet */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert
              className={`h-4 w-4 ${
                evaluation.flightSurgeonAlertRequired
                  ? "text-rose-400"
                  : "text-cyan-400"
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-slate-100">
              {evaluation.flightSurgeonAlertRequired
                ? "Flight Surgeon Escalation Packet Recommended"
                : "Telemetry Downlink Packet"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPacket((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-cyan-500/60 hover:text-cyan-200"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {showPacket ? "Hide Packet" : "Preview Packet"}
            </button>

            <button
              type="button"
              onClick={handleCopyPacket}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
                copied
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200"
                  : evaluation.flightSurgeonAlertRequired
                  ? "border-rose-500/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                  : "border-cyan-500/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
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
          <pre className="mt-2.5 max-h-56 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
            {packetText}
          </pre>
        )}
      </div>
    </section>
  );
}

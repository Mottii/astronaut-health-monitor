"use client";

import React from "react";
import { Activity, Eye, Flame, ShieldAlert } from "lucide-react";
import { EARTH_VS_SPACE_RANGES, MISSION_ENVIRONMENTS } from "@/data/nasaHrpData";
import type {
  EarthVsSpaceRange,
  EnvironmentTelemetry,
  MissionEnvironmentId,
  OcularFinding,
  VitalReadings,
} from "@/types/health";

export interface VitalsInputPanelProps {
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
  envId: MissionEnvironmentId;
  onUpdateVitals: (patch: Partial<VitalReadings>) => void;
  onUpdateEnvTelemetry: (patch: Partial<EnvironmentTelemetry>) => void;
}

interface SliderFieldConfig {
  key: keyof VitalReadings;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

function getBaselineNote(
  metricKey: EarthVsSpaceRange["metricKey"]
): EarthVsSpaceRange | undefined {
  return EARTH_VS_SPACE_RANGES.find((r) => r.metricKey === metricKey);
}

interface BaselineSliderProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  baseline?: EarthVsSpaceRange;
  onChange: (nextVal: number) => void;
}

function BaselineSlider({
  label,
  unit,
  value,
  min,
  max,
  step,
  baseline,
  onChange,
}: BaselineSliderProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141414] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-white">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            aria-label={label}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (!Number.isNaN(parsed)) onChange(parsed);
            }}
            className="w-16 rounded-lg border border-white/10 bg-[#202020] px-2 py-0.5 text-right font-mono text-xs font-medium tabular-nums text-white transition focus:border-white/35 focus:outline-none"
          />
          <span className="font-mono text-[11px] text-[#7e828a]">{unit}</span>
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} slider`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full"
      />

      {baseline && (
        <div
          className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px]"
          title={baseline.rationale}
        >
          <span className="rounded-full bg-[#1b1b1b] px-2 py-0.5 font-mono text-[#7e828a]">
            Earth: {baseline.earthNormal}
          </span>
          <span className="rounded-full border border-white/[0.08] bg-[#202020] px-2 py-0.5 font-mono text-white/90">
            Space: {baseline.spaceflightAdjusted}
          </span>
        </div>
      )}
    </div>
  );
}

const OCULAR_OPTIONS: Array<{ value: OcularFinding; label: string }> = [
  { value: "clear", label: "Clear Grid" },
  { value: "blurry_near", label: "Near Blur" },
  { value: "visual_halos", label: "Halos / Edema" },
];

export function VitalsInputPanel({
  vitals,
  envTelemetry,
  envId,
  onUpdateVitals,
  onUpdateEnvTelemetry,
}: VitalsInputPanelProps) {
  const env = MISSION_ENVIRONMENTS[envId];

  const vitalFields: SliderFieldConfig[] = [
    {
      key: "bloodPressureSystolic",
      label: "Systolic BP",
      unit: "mmHg",
      min: 80,
      max: 170,
      step: 1,
      value: vitals.bloodPressureSystolic,
    },
    {
      key: "bloodPressureDiastolic",
      label: "Diastolic BP",
      unit: "mmHg",
      min: 50,
      max: 110,
      step: 1,
      value: vitals.bloodPressureDiastolic,
    },
    {
      key: "heartRateBpm",
      label: "Heart Rate",
      unit: "bpm",
      min: 40,
      max: 140,
      step: 1,
      value: vitals.heartRateBpm,
    },
    {
      key: "bloodGlucoseMgDl",
      label: "Blood Glucose",
      unit: "mg/dL",
      min: 55,
      max: 190,
      step: 1,
      value: vitals.bloodGlucoseMgDl,
    },
    {
      key: "bodyTempC",
      label: "Body Temp",
      unit: "°C",
      min: 35.0,
      max: 39.5,
      step: 0.1,
      value: vitals.bodyTempC,
    },
    {
      key: "sleepHours",
      label: "Daily Sleep",
      unit: "hrs",
      min: 3.0,
      max: 10.0,
      step: 0.1,
      value: vitals.sleepHours,
    },
    {
      key: "moodScore",
      label: "Mood / Energy",
      unit: "/10",
      min: 1,
      max: 10,
      step: 1,
      value: vitals.moodScore,
    },
    {
      key: "hydrationMl",
      label: "Hydration",
      unit: "mL",
      min: 800,
      max: 3600,
      step: 50,
      value: vitals.hydrationMl,
    },
  ];

  return (
    <section
      aria-label="Crew Vitals and Habitat Sensor Inputs"
      className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-[#1a1a1a] p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
            <Activity className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            Crew &amp; Habitat Telemetry Input
          </p>
          <h2 className="mt-1 text-xl font-medium tracking-tight text-white">
            Spaceflight Baseline vs. Earth Normal
          </h2>
          <p className="mt-1 text-xs text-[#7e828a]">
            Calibrated for {env.gravityLabel} · Comm Delay{" "}
            {env.commDelayLabel}
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-[#141414] px-3 py-1 font-mono text-[11px] text-[#7e828a]">
          {env.gravityLabel}
        </span>
      </div>

      {/* Physiological Vitals Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {vitalFields.map((field) => {
          const baselineKey =
            field.key === "bloodPressureDiastolic"
              ? "bloodPressureSystolic"
              : field.key;
          return (
            <BaselineSlider
              key={field.key}
              label={field.label}
              unit={field.unit}
              value={field.value}
              min={field.min}
              max={field.max}
              step={field.step}
              baseline={
                field.key === "moodScore"
                  ? undefined
                  : getBaselineNote(baselineKey)
              }
              onChange={(nextVal) =>
                onUpdateVitals({ [field.key]: nextVal } as Partial<VitalReadings>)
              }
            />
          );
        })}
      </div>

      {/* Ocular Self-Exam & ARED Countermeasure Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-[#141414] p-3.5">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-white">
            <Eye className="h-3.5 w-3.5 text-[#7e828a]" aria-hidden="true" />
            <span>Ocular / Ultrasound Self-Check</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OCULAR_OPTIONS.map((opt) => {
              const active = vitals.ocularFinding === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateVitals({ ocularFinding: opt.value })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition active:scale-[0.98] ${
                    active
                      ? "bg-white text-[#0a0a0a]"
                      : "border border-white/10 bg-[#202020] text-[#7e828a] hover:border-white/25 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      opt.value === "clear"
                        ? "bg-emerald-400"
                        : opt.value === "blurry_near"
                        ? "bg-amber-400"
                        : "bg-rose-400"
                    }`}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-[#141414] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-white">
              <Flame className="h-3.5 w-3.5 text-[#7e828a]" aria-hidden="true" />
              ARED Bone Loading
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={vitals.aredExerciseCompleted}
              onClick={() =>
                onUpdateVitals({
                  aredExerciseCompleted: !vitals.aredExerciseCompleted,
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition active:scale-[0.98] ${
                vitals.aredExerciseCompleted
                  ? "bg-white text-[#0a0a0a]"
                  : "border border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  vitals.aredExerciseCompleted
                    ? "bg-emerald-500"
                    : "bg-amber-400"
                }`}
              />
              {vitals.aredExerciseCompleted ? "Logged Today" : "Pending"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#7e828a]">
            Daily axial load required in {env.gravityLabel} to suppress Ca2+
            bone loss.
          </p>
        </div>
      </div>

      {/* Habitat & Radiation Override Controls (OSDR EDA + RadLab) */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#141414] p-4">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          <span>Habitat Sensors (NASA OSDR EDA &amp; RadLab)</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BaselineSlider
            label="Cabin CO2 (EDA)"
            unit="mmHg"
            value={envTelemetry.cabinCo2MmHg}
            min={0.5}
            max={6.5}
            step={0.1}
            baseline={getBaselineNote("cabinCo2MmHg")}
            onChange={(nextCo2) =>
              onUpdateEnvTelemetry({ cabinCo2MmHg: nextCo2 })
            }
          />
          <BaselineSlider
            label="Daily Radiation (RadLab)"
            unit="mSv/day"
            value={envTelemetry.dailyRadiationMsv}
            min={0.2}
            max={5.0}
            step={0.05}
            baseline={getBaselineNote("dailyRadiationMsv")}
            onChange={(nextRad) => {
              const gcr = Number(
                Math.min(nextRad, envTelemetry.gcrDoseMsv).toFixed(2)
              );
              const saaSpe = Number(Math.max(0, nextRad - gcr).toFixed(2));
              onUpdateEnvTelemetry({
                dailyRadiationMsv: nextRad,
                gcrDoseMsv: gcr,
                saaOrSpeDoseMsv: saaSpe,
              });
            }}
          />
        </div>
      </div>
    </section>
  );
}

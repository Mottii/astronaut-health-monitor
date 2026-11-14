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
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-200">{label}</label>
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
            className="w-16 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-right text-xs font-semibold text-cyan-300 focus:border-cyan-400 focus:outline-none"
          />
          <span className="text-[11px] text-slate-400">{unit}</span>
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
        className="mt-2 h-1.5 w-full cursor-pointer accent-cyan-400"
      />

      {baseline && (
        <div
          className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px]"
          title={baseline.rationale}
        >
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
            Earth: {baseline.earthNormal}
          </span>
          <span className="rounded bg-cyan-950/70 px-1.5 py-0.5 text-cyan-300">
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
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
              Crew &amp; Habitat Telemetry Input
            </p>
            <h2 className="text-sm font-semibold text-slate-100">
              Spaceflight Baseline vs. Earth Normal ({env.gravityLabel})
            </h2>
          </div>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300">
          Comm Delay: {env.commDelayLabel}
        </span>
      </div>

      {/* Physiological Vitals Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-200">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span>Ocular / Ultrasound Self-Check</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {OCULAR_OPTIONS.map((opt) => {
              const active = vitals.ocularFinding === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateVitals({ ocularFinding: opt.value })}
                  className={`rounded border px-2 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? opt.value === "clear"
                        ? "border-emerald-400 bg-emerald-950/60 text-emerald-200"
                        : "border-rose-400 bg-rose-950/60 text-rose-200"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              ARED Resistive Bone Loading
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
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                vitals.aredExerciseCompleted
                  ? "border-emerald-400 bg-emerald-950/60 text-emerald-300"
                  : "border-amber-500/50 bg-amber-950/50 text-amber-300"
              }`}
            >
              {vitals.aredExerciseCompleted ? "Logged Today" : "Pending"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Daily axial load required in {env.gravityLabel} to suppress Ca2+ bone loss.
          </p>
        </div>
      </div>

      {/* Habitat & Radiation Override Controls (OSDR EDA + RadLab) */}
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          <span>Habitat Sensors (NASA OSDR EDA &amp; RadLab)</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

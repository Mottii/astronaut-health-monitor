"use client";

import React, { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { MISSION_ENVIRONMENTS } from "@/data/nasaHrpData";
import type {
  EnvironmentTelemetry,
  MissionEnvironmentId,
  SolTelemetryPoint,
  VitalReadings,
} from "@/types/health";

export interface TelemetryChartsProps {
  history: SolTelemetryPoint[];
  currentVitals: VitalReadings;
  currentEnvTelemetry: EnvironmentTelemetry;
  envId: MissionEnvironmentId;
}

type ChartTabId = "vitals" | "eda_co2" | "radlab";

/**
 * Appends live crew & habitat readings as "Sol 14 (Now)" without mutating the source history array.
 */
export function build14SolSeries(
  history: SolTelemetryPoint[],
  currentVitals: VitalReadings,
  currentEnvTelemetry: EnvironmentTelemetry
): SolTelemetryPoint[] {
  const livePoint: SolTelemetryPoint = {
    sol: "Sol 14 (Now)",
    heartRateBpm: currentVitals.heartRateBpm,
    systolicBp: currentVitals.bloodPressureSystolic,
    bloodGlucoseMgDl: currentVitals.bloodGlucoseMgDl,
    sleepHours: currentVitals.sleepHours,
    moodScore: currentVitals.moodScore,
    issCabinCo2MmHg: currentEnvTelemetry.cabinCo2MmHg,
    groundControlCo2MmHg: 0.35,
    gcrDoseMsv: currentEnvTelemetry.gcrDoseMsv,
    saaDoseMsv: currentEnvTelemetry.saaOrSpeDoseMsv,
    totalRadiationMsv: currentEnvTelemetry.dailyRadiationMsv,
  };

  return [...history, livePoint];
}

const CHART_TABS: Array<{ id: ChartTabId; label: string }> = [
  { id: "vitals", label: "Crew Vitals" },
  { id: "eda_co2", label: "OSDR EDA · CO2" },
  { id: "radlab", label: "RadLab · Dose" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#141414",
  borderColor: "rgba(255, 255, 255, 0.14)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#ffffff",
};

export function TelemetryCharts({
  history,
  currentVitals,
  currentEnvTelemetry,
  envId,
}: TelemetryChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTabId>("vitals");
  const series = build14SolSeries(history, currentVitals, currentEnvTelemetry);
  const env = MISSION_ENVIRONMENTS[envId];

  return (
    <section
      aria-label="14-Sol Telemetry Trends"
      className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-[#1a1a1a] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              <LineChartIcon
                className="h-3.5 w-3.5 text-white"
                aria-hidden="true"
              />
              Dynamic Telemetry Trends
            </p>
            <h2 className="mt-1 text-xl font-medium tracking-tight text-white">
              {env.name} — 14-Sol History
            </h2>
            <p className="mt-1 text-xs text-[#7e828a]">
              Live Sol 14 point updates instantaneously as vitals or habitat
              sensors change.
            </p>
          </div>
        </div>

        {/* Segmented Pill Switcher */}
        <div className="inline-flex w-fit flex-wrap gap-1 rounded-full border border-white/[0.08] bg-[#141414] p-1">
          {CHART_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#7e828a] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Surface */}
      <div className="h-[380px] w-full min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-[#141414] p-4 lg:min-h-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "vitals" ? (
            <ComposedChart
              data={series}
              margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="sol"
                tick={{ fill: "#7e828a", fontSize: 10 }}
                stroke="rgba(255,255,255,0.12)"
              />
              <YAxis
                tick={{ fill: "#7e828a", fontSize: 10 }}
                stroke="rgba(255,255,255,0.12)"
                domain={[40, 170]}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#7e828a" }} />
              <ReferenceArea
                y1={75}
                y2={110}
                fill="#ffffff"
                fillOpacity={0.04}
                label={{
                  value: "Space Glucose Target (75–110)",
                  fill: "#7e828a",
                  fontSize: 9,
                  position: "insideTopLeft",
                }}
              />
              <Line
                type="monotone"
                dataKey="systolicBp"
                name="Systolic BP (mmHg)"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="bloodGlucoseMgDl"
                name="Glucose (mg/dL)"
                stroke="#ffffff"
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="heartRateBpm"
                name="Heart Rate (bpm)"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
            </ComposedChart>
          ) : activeTab === "eda_co2" ? (
            <ComposedChart
              data={series}
              margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="sol"
                tick={{ fill: "#7e828a", fontSize: 10 }}
                stroke="rgba(255,255,255,0.12)"
              />
              <YAxis
                tick={{ fill: "#7e828a", fontSize: 10 }}
                stroke="rgba(255,255,255,0.12)"
                domain={[0, 6]}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#7e828a" }} />
              <ReferenceLine
                y={3.5}
                stroke="#f87171"
                strokeDasharray="4 4"
                label={{
                  value: "SANS Hypercapnia Threshold (3.5 mmHg)",
                  fill: "#f87171",
                  fontSize: 10,
                  position: "insideTopLeft",
                }}
              />
              <Area
                type="monotone"
                dataKey="issCabinCo2MmHg"
                name="Habitat Cabin CO2 (mmHg)"
                fill="#fbbf24"
                fillOpacity={0.14}
                stroke="#fbbf24"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="groundControlCo2MmHg"
                name="Ground Control CO2 (mmHg)"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={series}
              margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="sol"
                tick={{ fill: "#7e828a", fontSize: 10 }}
                stroke="rgba(255,255,255,0.12)"
              />
              <YAxis
                tick={{ fill: "#7e828a", fontSize: 10 }}
                stroke="rgba(255,255,255,0.12)"
                domain={[0, "auto"]}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#7e828a" }} />
              <ReferenceLine
                y={2.0}
                stroke="#f87171"
                strokeDasharray="4 4"
                label={{
                  value: "Storm Shelter Action (2.0 mSv/day)",
                  fill: "#f87171",
                  fontSize: 10,
                  position: "insideTopLeft",
                }}
              />
              <Area
                type="monotone"
                dataKey="gcrDoseMsv"
                name="GCR Baseline (mSv)"
                stackId="rad"
                fill="#ffffff"
                fillOpacity={0.12}
                stroke="#ffffff"
              />
              <Area
                type="monotone"
                dataKey="saaDoseMsv"
                name="SAA / SPE Burst (mSv)"
                stackId="rad"
                fill="#f87171"
                fillOpacity={0.24}
                stroke="#fb7185"
              />
              <Line
                type="monotone"
                dataKey="totalRadiationMsv"
                name="Total Daily Dose (mSv)"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Caption Note */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#141414] px-4 py-3 text-xs leading-relaxed text-[#7e828a]">
        {activeTab === "vitals" &&
          "Shaded neutral band indicates spaceflight-adjusted fasting blood glucose (75–110 mg/dL, NASA OSDR OSD-104)."}
        {activeTab === "eda_co2" &&
          "Compares closed-habitat cabin pCO2 against Earth ground control (~0.35 mmHg) per NASA OSDR Environmental Data Application (EDA)."}
        {activeTab === "radlab" &&
          "Splits absorbed dose into Galactic Cosmic Rays (GCR) and South Atlantic Anomaly / Solar Particle Events (SAA/SPE) per NASA OSDR RadLab & CSA dosimetry."}
      </div>
    </section>
  );
}

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
  { id: "vitals", label: "Crew Vitals (14-Sol)" },
  { id: "eda_co2", label: "OSDR EDA: Cabin CO2" },
  { id: "radlab", label: "OSDR RadLab: Radiation" },
];

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
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-cyan-400" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
              Dynamic Telemetry Trends
            </p>
            <h2 className="text-sm font-semibold text-slate-100">
              {env.name} — 14-Sol History + Live Sol 14
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
          {CHART_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-64 w-full min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/90 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "vitals" ? (
            <ComposedChart
              data={series}
              margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="sol"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
                domain={[40, 170]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  fontSize: "12px",
                  color: "#f1f5f9",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <ReferenceArea
                y1={75}
                y2={110}
                fill="#06b6d4"
                fillOpacity={0.08}
                label={{
                  value: "Space Glucose Target (75–110)",
                  fill: "#22d3ee",
                  fontSize: 9,
                  position: "insideTopLeft",
                }}
              />
              <Line
                type="monotone"
                dataKey="systolicBp"
                name="Systolic BP (mmHg)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="bloodGlucoseMgDl"
                name="Glucose (mg/dL)"
                stroke="#22d3ee"
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
              margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="sol"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
                domain={[0, 6]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  fontSize: "12px",
                  color: "#f1f5f9",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <ReferenceLine
                y={3.5}
                stroke="#ef4444"
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
                fill="#f59e0b"
                fillOpacity={0.22}
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
              margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="sol"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                stroke="#334155"
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  fontSize: "12px",
                  color: "#f1f5f9",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <ReferenceLine
                y={2.0}
                stroke="#ef4444"
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
                fill="#06b6d4"
                fillOpacity={0.25}
                stroke="#22d3ee"
              />
              <Area
                type="monotone"
                dataKey="saaDoseMsv"
                name="SAA / SPE Burst (mSv)"
                stackId="rad"
                fill="#f43f5e"
                fillOpacity={0.3}
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

      <p className="mt-2 text-[11px] text-slate-400">
        {activeTab === "vitals" &&
          "Shaded cyan zone shows spaceflight-adjusted fasting blood glucose (75–110 mg/dL, NASA OSDR OSD-104)."}
        {activeTab === "eda_co2" &&
          "Compares closed-habitat cabin pCO2 against Earth ground control (~0.35 mmHg) per NASA OSDR Environmental Data Application (EDA)."}
        {activeTab === "radlab" &&
          "Splits absorbed dose into Galactic Cosmic Rays (GCR) and South Atlantic Anomaly / Solar Particle Events (SAA/SPE) per NASA OSDR RadLab & CSA dosimetry."}
      </p>
    </section>
  );
}

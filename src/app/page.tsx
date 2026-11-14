"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Orbit,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Sun,
} from "lucide-react";
import { AutonomousCmoPanel } from "@/components/AutonomousCmoPanel";
import { BioTwinBodyMap } from "@/components/BioTwinBodyMap";
import { RoutineGamificationBar } from "@/components/RoutineGamificationBar";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { VitalsInputPanel } from "@/components/VitalsInputPanel";
import {
  BASE_14_SOL_HISTORY,
  DEFAULT_ROUTINE_TASKS,
  DEMO_SCENARIOS,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import {
  applySpaceWeatherToTelemetry,
  fetchSpaceWeatherAlert,
  type SpaceWeatherStatus,
} from "@/lib/nasaApi";
import {
  DEFAULT_ROUTINE_PROGRESS,
  loadRoutineProgress,
  resetRoutineDay,
  saveRoutineProgress,
  toggleRoutineTask,
} from "@/lib/routineStorage";
import { clampVitalReadings, evaluateCrewHealth } from "@/lib/triageEngine";
import type {
  BodySystemId,
  EnvironmentTelemetry,
  MissionEnvironmentId,
  MissionScenario,
  RoutineProgressState,
  ScenarioId,
  TriageStatus,
  VitalReadings,
} from "@/types/health";

const ENVIRONMENT_ORDER: MissionEnvironmentId[] = [
  "iss_orbit",
  "lunar_rover",
  "mars_transit",
  "mars_base",
];

const READINESS_BADGE: Record<
  TriageStatus,
  { label: string; badgeClass: string; scoreClass: string }
> = {
  green: {
    label: "NOMINAL",
    badgeClass: "border-emerald-500/45 bg-emerald-500/15 text-emerald-300",
    scoreClass: "text-emerald-300",
  },
  amber: {
    label: "ELEVATED",
    badgeClass: "border-amber-500/45 bg-amber-500/15 text-amber-300",
    scoreClass: "text-amber-300",
  },
  red: {
    label: "CRITICAL",
    badgeClass: "border-rose-500/45 bg-rose-500/15 text-rose-300",
    scoreClass: "text-rose-300",
  },
};

const OFFICIAL_CHALLENGE_LINKS = [
  {
    label: "NASA HRP · 5 Hazards of Human Spaceflight",
    url: "https://www.nasa.gov/hrp/hazards/",
  },
  {
    label: "NASA HRP · Risks of Human Spaceflight",
    url: "https://www.nasa.gov/hrp/risks/",
  },
  {
    label: "NASA HRP · Ongoing Research in Space",
    url: "https://www.nasa.gov/hrp/ongoing-hrp-research/",
  },
  {
    label: "CSA · Monitoring Radiation for Astronaut Health",
    url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
  },
  {
    label: "CSA · Why Conduct Science in Space?",
    url: "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
  },
  {
    label: "NASA OSDR · EDA & RadLab Studies",
    url: "https://osdr.nasa.gov/bio/repo",
  },
];

export default function HomePage() {
  const initialScenario = DEMO_SCENARIOS[0];

  const [envId, setEnvId] = useState<MissionEnvironmentId>(
    initialScenario.environmentId
  );
  const [activeScenarioId, setActiveScenarioId] = useState<
    ScenarioId | "custom"
  >(initialScenario.id);
  const [vitals, setVitals] = useState<VitalReadings>(initialScenario.vitals);
  const [envTelemetry, setEnvTelemetry] = useState<EnvironmentTelemetry>(
    initialScenario.envTelemetry
  );
  const [selectedSystem, setSelectedSystem] = useState<BodySystemId>(
    initialScenario.focusSystem
  );
  const [routineProgress, setRoutineProgress] = useState<RoutineProgressState>(
    DEFAULT_ROUTINE_PROGRESS
  );
  const [spaceWeather, setSpaceWeather] = useState<SpaceWeatherStatus | null>(
    null
  );
  const [isSyncingWeather, setIsSyncingWeather] = useState<boolean>(false);

  useEffect(() => {
    setRoutineProgress(loadRoutineProgress());
  }, []);

  const evaluation = useMemo(
    () => evaluateCrewHealth(vitals, envTelemetry, envId),
    [vitals, envTelemetry, envId]
  );

  const envConfig = MISSION_ENVIRONMENTS[envId];
  const readinessStyle = READINESS_BADGE[evaluation.overallStatus];

  function handleSelectEnvironment(nextEnvId: MissionEnvironmentId) {
    setEnvId(nextEnvId);
    setActiveScenarioId("custom");
    const defaultEnvTelemetry = MISSION_ENVIRONMENTS[nextEnvId].defaultTelemetry;
    setEnvTelemetry(
      spaceWeather
        ? applySpaceWeatherToTelemetry(defaultEnvTelemetry, spaceWeather)
        : defaultEnvTelemetry
    );
  }

  function handleSelectScenario(scenario: MissionScenario) {
    setActiveScenarioId(scenario.id);
    setEnvId(scenario.environmentId);
    setVitals(scenario.vitals);
    setEnvTelemetry(scenario.envTelemetry);
    setSelectedSystem(scenario.focusSystem);
  }

  function handleUpdateVitals(patch: Partial<VitalReadings>) {
    setActiveScenarioId("custom");
    setVitals((prev) => clampVitalReadings({ ...prev, ...patch }));
  }

  function handleUpdateEnvTelemetry(patch: Partial<EnvironmentTelemetry>) {
    setActiveScenarioId("custom");
    setEnvTelemetry((prev) => ({ ...prev, ...patch }));
  }

  async function handleSyncSpaceWeather() {
    if (isSyncingWeather) {
      return;
    }
    setIsSyncingWeather(true);
    try {
      const weather = await fetchSpaceWeatherAlert();
      setSpaceWeather(weather);
      setActiveScenarioId("custom");
      setEnvTelemetry((prev) =>
        applySpaceWeatherToTelemetry(
          {
            ...prev,
            dailyRadiationMsv: envConfig.defaultTelemetry.dailyRadiationMsv,
            saaOrSpeDoseMsv: envConfig.defaultTelemetry.saaOrSpeDoseMsv,
          },
          weather
        )
      );
    } finally {
      setIsSyncingWeather(false);
    }
  }

  function handleToggleRoutineTask(taskId: string) {
    setRoutineProgress((prev) => {
      const next = toggleRoutineTask(prev, taskId, DEFAULT_ROUTINE_TASKS);
      saveRoutineProgress(next);
      return next;
    });
  }

  function handleResetRoutineDay() {
    const reset = resetRoutineDay();
    saveRoutineProgress(reset);
    setRoutineProgress(reset);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6">
        {/* Top Mission Telemetry Command Bar */}
        <header className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            {/* Branding & Active Mission Context */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
                  <Orbit className="h-3.5 w-3.5" aria-hidden="true" />
                  ARES-MED OS
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  NASA Space Apps 2026 · BioTwin &amp; Autonomous CMO Console
                </span>
              </div>
              <h1 className="mt-1.5 text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
                {envConfig.name}
              </h1>
              <p className="text-xs text-slate-400">{envConfig.subtitle}</p>
            </div>

            {/* Readiness Score Gauge & Live NASA DONKI Sync */}
            <div className="flex flex-wrap items-center gap-3">
              {/* NASA DONKI Space Weather Sync */}
              <div className="flex flex-col items-start gap-1 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncSpaceWeather}
                    disabled={isSyncingWeather}
                    className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/50 bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        isSyncingWeather ? "animate-spin" : ""
                      }`}
                      aria-hidden="true"
                    />
                    {isSyncingWeather
                      ? "Syncing NASA DONKI..."
                      : "Sync Live NASA DONKI"}
                  </button>

                  {spaceWeather && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        spaceWeather.isFallback
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                          : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      <Sun className="h-3 w-3" aria-hidden="true" />
                      {spaceWeather.isFallback
                        ? "OSDR RadLab Fallback"
                        : "Live DONKI"}
                    </span>
                  )}
                </div>

                <p className="max-w-xs text-[10px] text-slate-400">
                  {spaceWeather
                    ? spaceWeather.summary
                    : "Pull live NASA DONKI solar flare telemetry (falls back to OSDR RadLab SPE benchmark offline)."}
                </p>
              </div>

              {/* Overall Mission Readiness Gauge */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Crew Readiness
                  </span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span
                      className={`text-2xl font-bold ${readinessStyle.scoreClass}`}
                    >
                      {evaluation.readinessScore}
                    </span>
                    <span className="text-xs text-slate-500">/100</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${readinessStyle.badgeClass}`}
                  >
                    {readinessStyle.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {evaluation.activeCascades.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        0 Active Cascades
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <AlertTriangle
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {evaluation.activeCascades.length} Cascade
                        {evaluation.activeCascades.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Environment Switcher + Active NASA HRP 5 Hazards */}
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-3 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Mission Environment &amp; Communication Delay Profile
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ENVIRONMENT_ORDER.map((id) => {
                  const env = MISSION_ENVIRONMENTS[id];
                  const active = envId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectEnvironment(id)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-2 text-left transition ${
                        active
                          ? "border-cyan-400 bg-cyan-950/50 text-cyan-100 shadow-sm shadow-cyan-500/20"
                          : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold">
                          {env.name}
                        </span>
                        {env.autonomousModeRequired && (
                          <Radio
                            className="h-3 w-3 shrink-0 text-amber-400"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {env.gravityLabel} · {env.commDelayLabel}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                <Shield className="h-3 w-3 text-cyan-400" aria-hidden="true" />
                Active NASA HRP Hazards ({envConfig.activeHazards.length}/5)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {envConfig.activeHazards.map((hazardId) => {
                  const hazard = NASA_HAZARDS[hazardId];
                  const weight = envConfig.hazardWeights[hazardId];
                  return (
                    <a
                      key={hazardId}
                      href={hazard.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={hazard.description}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-cyan-500/60 hover:text-cyan-200"
                    >
                      <span>{hazard.shortLabel}</span>
                      <span className="font-mono text-[10px] text-cyan-400">
                        ×{weight.toFixed(1)}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4 One-Click Demo Scenarios */}
          <div className="mt-3 border-t border-slate-800/80 pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              One-Click Space-Medicine Simulation Presets (Judge Demo Modes)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {DEMO_SCENARIOS.map((scenario) => {
                const isSelected = activeScenarioId === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => handleSelectScenario(scenario)}
                    aria-pressed={isSelected}
                    className={`flex flex-col justify-between rounded-lg border p-2.5 text-left transition ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-950/45 shadow-sm shadow-cyan-500/20"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-100">
                        {scenario.name}
                      </span>
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">
                        {scenario.badge}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                      {scenario.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Main 3-Column Open MCT Telemetry Grid */}
        <main className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <BioTwinBodyMap
              assessments={evaluation.systems}
              cascades={evaluation.activeCascades}
              selectedSystem={selectedSystem}
              onSelectSystem={setSelectedSystem}
            />
          </div>

          <div className="flex flex-col gap-5 lg:col-span-5">
            <VitalsInputPanel
              vitals={vitals}
              envTelemetry={envTelemetry}
              envId={envId}
              onUpdateVitals={handleUpdateVitals}
              onUpdateEnvTelemetry={handleUpdateEnvTelemetry}
            />

            <TelemetryCharts
              history={BASE_14_SOL_HISTORY[envId]}
              currentVitals={vitals}
              currentEnvTelemetry={envTelemetry}
              envId={envId}
            />
          </div>

          <div className="lg:col-span-4">
            <AutonomousCmoPanel
              selectedSystem={selectedSystem}
              evaluation={evaluation}
              vitals={vitals}
              envTelemetry={envTelemetry}
              envId={envId}
            />
          </div>
        </main>

        {/* Gamified Daily Countermeasure Checklist Bar */}
        <RoutineGamificationBar
          tasks={DEFAULT_ROUTINE_TASKS}
          progress={routineProgress}
          onToggleTask={handleToggleRoutineTask}
          onResetDay={handleResetRoutineDay}
          onSelectSystem={setSelectedSystem}
        />

        {/* Official NASA / CSA / OSDR Citations Footer */}
        <footer className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Activity className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span>
                Scientific Reference &amp; Open-Data Citations (NASA HRP · OSDR
                · CSA · DONKI)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              MIT License · Open-Source Prototype (NASA Space Apps Almaty 2026)
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICIAL_CHALLENGE_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-200"
              >
                <span className="truncate">{link.label}</span>
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 text-cyan-400"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

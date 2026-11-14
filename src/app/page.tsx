"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Radio,
  RefreshCw,
  Shield,
  Sun,
} from "lucide-react";
import { AutonomousCmoPanel } from "@/components/AutonomousCmoPanel";
import { BioTwinBodyMap } from "@/components/BioTwinBodyMap";
import { PresentationView } from "@/components/PresentationView";
import { RoutineGamificationBar } from "@/components/RoutineGamificationBar";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { VitalsInputPanel } from "@/components/VitalsInputPanel";
import {
  BASE_14_SOL_HISTORY,
  BODY_SYSTEM_METADATA,
  DEFAULT_ROUTINE_TASKS,
  DEMO_SCENARIOS,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";
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

const ENV_SHORT_LABEL: Record<MissionEnvironmentId, string> = {
  iss_orbit: "ISS Orbit",
  lunar_rover: "Lunar Rover",
  mars_transit: "Mars Transit",
  mars_base: "Mars Base",
};

const SYSTEM_ACCENT_HEX: Record<BodySystemId, string> = {
  neuro_ocular: "#2dd4bf",
  behavioral_circadian: "#818cf8",
  cardiovascular: "#fb7185",
  immune_hematology: "#c084fc",
  metabolic_endocrine: "#f97316",
  musculoskeletal_renal: "#4ade80",
};

const READINESS_STATUS: Record<
  TriageStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  green: {
    label: "NOMINAL",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-white text-[#0a0a0a]",
  },
  amber: {
    label: "ELEVATED",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-400 text-[#0a0a0a]",
  },
  red: {
    label: "CRITICAL",
    dotClass: "bg-white",
    badgeClass: "bg-rose-500 text-white",
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
  const [surfaceMode, setSurfaceMode] = useState<"presentation" | "console">(
    "presentation"
  );
  const [slideIndex, setSlideIndex] = useState<number>(0);

  useEffect(() => {
    setRoutineProgress(loadRoutineProgress());
  }, []);

  const evaluation = useMemo(
    () => evaluateCrewHealth(vitals, envTelemetry, envId),
    [vitals, envTelemetry, envId]
  );

  const envConfig = MISSION_ENVIRONMENTS[envId];
  const readinessStyle = READINESS_STATUS[evaluation.overallStatus];
  const selectedMeta = BODY_SYSTEM_METADATA[selectedSystem];
  const activeScenario = DEMO_SCENARIOS.find((s) => s.id === activeScenarioId);

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

  function handleSelectSlide(nextIndex: number) {
    const slide = PRESENTATION_SLIDES[nextIndex];
    if (!slide) return;
    setSlideIndex(nextIndex);
    const scenario = DEMO_SCENARIOS.find((s) => s.id === slide.scenarioId);
    if (scenario) {
      setActiveScenarioId(scenario.id);
      setEnvId(scenario.environmentId);
      setVitals(scenario.vitals);
      setEnvTelemetry(scenario.envTelemetry);
    }
    setSelectedSystem(slide.focusSystem);
  }

  if (surfaceMode === "presentation") {
    return (
      <PresentationView
        slideIndex={slideIndex}
        onSelectSlide={handleSelectSlide}
        onOpenConsole={() => setSurfaceMode("console")}
        evaluation={evaluation}
        vitals={vitals}
        envTelemetry={envTelemetry}
        selectedSystem={selectedSystem}
        onSelectSystem={setSelectedSystem}
        isSyncingWeather={isSyncingWeather}
        onSyncSpaceWeather={handleSyncSpaceWeather}
        spaceWeather={spaceWeather}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Fixed Minimal Top Navbar (x.ai/bot style) */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#0a0a0a]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left Geometric ARES Mark */}
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-white"
          >
            <svg
              viewBox="0 0 32 32"
              className="h-6 w-6 text-white"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 26L14.5 6H18.5L28 26H23.2L16.5 11.4L9.2 26H4Z"
                fill="currentColor"
              />
              <path
                d="M5 20.5C11.5 14 20.5 11 29 9.5"
                stroke="#0a0a0a"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span>ARES-MED</span>
          </a>

          {/* Center Environment Pill Tabs (Desktop) */}
          <nav
            aria-label="Mission Environment Profile"
            className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-[#141414] p-1 lg:flex"
          >
            {ENVIRONMENT_ORDER.map((id) => {
              const env = MISSION_ENVIRONMENTS[id];
              const active = envId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectEnvironment(id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-white text-[#0a0a0a]"
                      : "text-[#7e828a] hover:text-white"
                  }`}
                >
                  <span>{ENV_SHORT_LABEL[id]}</span>
                  {env.autonomousModeRequired && (
                    <Radio
                      className={`h-3 w-3 ${
                        active ? "text-amber-600" : "text-amber-400"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Pills: Presentation Mode, DONKI Sync & Crew Readiness */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSurfaceMode("presentation")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-[#1a1a1a] px-3.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-[#222222]"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#7e828a]" aria-hidden="true" />
              <span className="hidden sm:inline">Presentation</span>
            </button>

            <button
              type="button"
              onClick={handleSyncSpaceWeather}
              disabled={isSyncingWeather}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-[#1a1a1a] px-3.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-[#222222] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#7e828a] ${
                  isSyncingWeather ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isSyncingWeather ? "Syncing DONKI..." : "Sync Live NASA DONKI"}
              </span>
              <span className="sm:hidden">DONKI</span>
            </button>

            <a
              href="#biotwin-console"
              className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-medium transition hover:opacity-95 ${readinessStyle.badgeClass}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${readinessStyle.dotClass}`}
              />
              <span>Readiness</span>
              <span className="font-mono font-semibold tabular-nums">
                {evaluation.readinessScore}/100
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Flow */}
      <main id="top" className="pt-24 sm:pt-28">
        {/* Hero Section */}
        <section className="mx-auto max-w-[1360px] px-4 text-center sm:px-6">
          {/* Launch Kicker Pill */}
          <a
            href="#citations"
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a]/70 py-1.5 pr-2 pl-3.5 text-xs font-medium transition hover:border-white/20 hover:bg-[#1a1a1a] sm:text-sm"
          >
            <span className="text-white">NASA Space Apps 2026</span>
            <span className="hidden text-[#7e828a] sm:inline">
              Autonomous Space Medicine Console
            </span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-white group-hover:text-[#0a0a0a]">
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </span>
          </a>

          {/* Editorial H1 with Inline Geometric BioTwin Mark */}
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-medium leading-[1.05] tracking-tight text-white text-balance sm:text-5xl lg:text-6xl">
            Meet
            <span
              className="mx-2.5 inline-flex -translate-y-[0.06em] align-middle"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 92 92"
                className="h-[0.92em] w-[0.92em]"
                fill="none"
              >
                <rect width="92" height="92" rx="46" fill="#ffffff" />
                <g transform="rotate(-10 46 46)">
                  <rect
                    x="30"
                    y="30"
                    width="11"
                    height="24"
                    rx="5.5"
                    fill="#0a0a0a"
                  />
                  <rect
                    x="51"
                    y="30"
                    width="11"
                    height="24"
                    rx="5.5"
                    fill="#0a0a0a"
                  />
                </g>
              </svg>
            </span>
            ARES-MED
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#7e828a] text-balance sm:text-lg lg:text-xl">
            Autonomous medical triage for deep-space crews. Live multi-organ
            physiological cascades, Earth-vs-Space baselines, and guided CMO
            protocols.
          </p>

          {/* Mobile/Tablet Environment Selector */}
          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-1.5 lg:hidden">
            {ENVIRONMENT_ORDER.map((id) => {
              const active = envId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectEnvironment(id)}
                  aria-pressed={active}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-white text-[#0a0a0a]"
                      : "border border-white/10 bg-[#1a1a1a] text-[#7e828a] hover:text-white"
                  }`}
                >
                  {ENV_SHORT_LABEL[id]}
                </button>
              );
            })}
          </div>

          {/* 4 One-Click Judge Demo Scenario Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {DEMO_SCENARIOS.map((scenario) => {
              const isSelected = activeScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => handleSelectScenario(scenario)}
                  aria-pressed={isSelected}
                  className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium transition active:scale-[0.98] ${
                    isSelected
                      ? "bg-white text-[#0a0a0a] hover:bg-[#f5f4f0]"
                      : "border border-white/10 bg-[#1a1a1a] text-white hover:border-white/25 hover:bg-[#222222]"
                  }`}
                >
                  <span>{scenario.name}</span>
                  <span
                    className={`hidden rounded-full px-2 py-0.5 font-mono text-[10px] xl:inline-block ${
                      isSelected
                        ? "bg-[#0a0a0a]/10 text-[#0a0a0a]"
                        : "bg-white/[0.06] text-[#7e828a]"
                    }`}
                  >
                    {scenario.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Scenario + Live Space Weather Telemetry Caption */}
          <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[#7e828a]">
            <span>
              {activeScenario
                ? activeScenario.description
                : `${envConfig.name} · ${envConfig.subtitle}`}
            </span>
            {spaceWeather && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${
                  spaceWeather.isFallback
                    ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <Sun className="h-3 w-3" aria-hidden="true" />
                {spaceWeather.isFallback ? "OSDR RadLab Fallback" : "Live DONKI"}
                {" · "}
                {spaceWeather.summary}
              </span>
            )}
          </div>
        </section>

        {/* Centerpiece x.ai/bot macOS Desktop Window Frame */}
        <section
          id="biotwin-console"
          className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-12 sm:px-6"
        >
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#141414] shadow-2xl">
            {/* macOS Window Title Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#141414] px-4 py-3">
              {/* Traffic Light Dots */}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-2 hidden font-mono text-[11px] text-[#7e828a] sm:inline">
                  {envConfig.name} · {envConfig.gravityLabel}
                </span>
              </div>

              {/* Centered Active System Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#202020] px-3.5 py-1 text-xs font-medium text-white">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: SYSTEM_ACCENT_HEX[selectedSystem],
                  }}
                />
                <span>{selectedMeta.name}</span>
                <span className="hidden font-mono text-[10px] text-[#7e828a] sm:inline">
                  · {envConfig.commDelayLabel}
                </span>
              </div>

              {/* Right Active NASA HRP Hazard Pills */}
              <div className="hidden items-center gap-1.5 xl:flex">
                <Shield
                  className="mr-1 h-3.5 w-3.5 text-[#7e828a]"
                  aria-hidden="true"
                />
                {envConfig.activeHazards.slice(0, 4).map((hazardId) => {
                  const hazard = NASA_HAZARDS[hazardId];
                  const weight = envConfig.hazardWeights[hazardId];
                  return (
                    <a
                      key={hazardId}
                      href={hazard.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={hazard.description}
                      className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#1b1b1b] px-2.5 py-0.5 text-[10px] font-medium text-[#7e828a] transition hover:border-white/25 hover:text-white"
                    >
                      <span>{hazard.shortLabel}</span>
                      <span className="font-mono text-white">
                        ×{weight.toFixed(1)}
                      </span>
                    </a>
                  );
                })}
              </div>

              {/* Compact Cascade Status Pill on smaller viewports */}
              <div className="flex items-center xl:hidden">
                {evaluation.activeCascades.length === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />0
                    Cascades
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {evaluation.activeCascades.length} Cascade
                    {evaluation.activeCascades.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Window Interior: BioTwin Sidebar + Anatomical Viewport (7 cols) + Autonomous CMO (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <BioTwinBodyMap
                  assessments={evaluation.systems}
                  cascades={evaluation.activeCascades}
                  selectedSystem={selectedSystem}
                  onSelectSystem={setSelectedSystem}
                  vitals={vitals}
                  envTelemetry={envTelemetry}
                />
              </div>

              <div className="lg:col-span-5">
                <AutonomousCmoPanel
                  selectedSystem={selectedSystem}
                  evaluation={evaluation}
                  vitals={vitals}
                  envTelemetry={envTelemetry}
                  envId={envId}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Bento Telemetry Section (x.ai/bot Section 3 Layout) */}
        <section className="mx-auto mt-20 max-w-[1440px] px-4 sm:mt-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-tight text-white text-balance sm:text-4xl lg:text-5xl">
              Real-time physiological &amp; habitat telemetry
            </h2>
            <p className="mt-3 text-base text-[#7e828a] text-balance sm:text-lg">
              Adjust astronaut vitals and closed-habitat sensor feeds to observe
              live cascade propagation across 14 Sols.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        </section>

        {/* Countermeasure Routine Section */}
        <section className="mx-auto mt-10 max-w-[1440px] px-4 sm:mt-12 sm:px-6">
          <RoutineGamificationBar
            tasks={DEFAULT_ROUTINE_TASKS}
            progress={routineProgress}
            onToggleTask={handleToggleRoutineTask}
            onResetDay={handleResetRoutineDay}
            onSelectSystem={setSelectedSystem}
          />
        </section>

        {/* Bottom CTA & Signature x.ai/bot Concentric Orbital Hairline Graphic */}
        <section className="relative mx-auto mt-24 overflow-hidden pt-12 text-center">
          <div className="relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="text-3xl font-medium tracking-tight text-white text-balance sm:text-4xl lg:text-5xl">
              Autonomous readiness for every horizon
            </h2>
            <p className="mt-3 text-base text-[#7e828a] text-balance sm:text-lg">
              Built on NASA Human Research Program risks, OSDR environmental
              studies, and CSA space-radiation dosimetry.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSyncSpaceWeather}
                disabled={isSyncingWeather}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#f5f4f0] active:scale-[0.98] disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isSyncingWeather ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {isSyncingWeather
                  ? "Syncing Live NASA DONKI..."
                  : "Sync Live NASA DONKI"}
              </button>
              <a
                href="#biotwin-console"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a] px-6 text-sm font-medium text-white transition hover:border-white/25 hover:bg-[#222222]"
              >
                Return to BioTwin Console
              </a>
            </div>
          </div>

          {/* Giant Concentric Hairline Orbital Graphic (x.ai/bot bottom hero motif) */}
          <div
            className="pointer-events-none relative mx-auto -mt-4 h-[210px] w-full max-w-[1200px] sm:h-[270px]"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 1200 320"
              className="h-full w-full"
              fill="none"
              preserveAspectRatio="xMidYMin slice"
            >
              <circle
                cx="600"
                cy="420"
                r="380"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
              <circle
                cx="600"
                cy="420"
                r="310"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <circle
                cx="600"
                cy="420"
                r="230"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              {/* Tilted Geometric BioTwin Eye Cutouts */}
              <g transform="rotate(-12 600 280)">
                <rect
                  x="522"
                  y="210"
                  width="44"
                  height="112"
                  rx="22"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                />
                <rect
                  x="612"
                  y="202"
                  width="44"
                  height="112"
                  rx="22"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                />
              </g>
            </svg>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
          </div>
        </section>
      </main>

      {/* Scientific Citations Footer */}
      <footer
        id="citations"
        className="border-t border-white/[0.07] bg-[#0a0a0a] py-10 text-xs text-[#7e828a]"
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-medium text-white">
              <Activity className="h-4 w-4 text-[#7e828a]" aria-hidden="true" />
              <span>
                Scientific Reference &amp; Open-Data Citations (NASA HRP · OSDR
                · CSA · DONKI)
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#7e828a]">
              MIT License · Open-Source Prototype (NASA Space Apps Almaty 2026)
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICIAL_CHALLENGE_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-[#141414] px-4 py-3 text-xs text-[#7e828a] transition hover:border-white/20 hover:text-white"
              >
                <span className="truncate">{link.label}</span>
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 text-[#7e828a]"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

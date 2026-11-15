"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  FlaskConical,
  ListChecks,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Sun,
  UserCheck,
  X,
} from "lucide-react";
import { AutonomousCmoPanel } from "@/components/AutonomousCmoPanel";
import { BioTwinBodyMap } from "@/components/BioTwinBodyMap";
import { ResizablePanels } from "@/components/ResizablePanels";
import { HardwareBridgeDrawer } from "@/components/HardwareBridgeDrawer";
import { PresentationView } from "@/components/PresentationView";
import { RoutineGamificationBar } from "@/components/RoutineGamificationBar";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { VitalsInputPanel } from "@/components/VitalsInputPanel";
import {
  BASE_14_SOL_HISTORY,
  BODY_SYSTEM_METADATA,
  CURATED_OSDR_STUDIES,
  DEFAULT_ROUTINE_TASKS,
  DEMO_SCENARIOS,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import { PRESENTATION_SLIDES } from "@/data/presentationSlides";
import { generateAstroskinTelemetryFrame } from "@/lib/biometricBridge";
import {
  fetchIssLiveSnapshot,
  fetchOsdrStudyMetadata,
} from "@/lib/issLiveTelemetry";
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
import {
  CREW_PROFILE_STORAGE_KEY,
  createDefaultCrewProfilesState,
  loadCrewProfilesState,
  saveCrewProfilesState,
  type CrewProfilesStorageState,
} from "@/lib/crewProfileStorage";
import { fuseTelemetryStreams } from "@/lib/telemetryMultiplexer";
import {
  applyCountermeasureToState,
  clampVitalReadings,
  evaluateCrewHealth,
} from "@/lib/triageEngine";
import type {
  BiometricSourceType,
  BodySystemId,
  CountermeasureActionSpec,
  EnvironmentTelemetry,
  ExamStepFinding,
  ExecutedActionLog,
  IssLiveTelemetrySnapshot,
  MissionEnvironmentId,
  MissionScenario,
  OsdrStudyLiveMetadata,
  RoutineProgressState,
  ScenarioId,
  SelectedSubStructure,
  TelemetryMode,
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
  iss_orbit: "ISS",
  lunar_rover: "Lunar",
  mars_transit: "Transit",
  mars_base: "Mars Base",
};

const SCENARIO_SHORT_LABEL: Record<ScenarioId, string> = {
  nominal: "Nominal",
  sans_co2_fluid_shift: "SANS + CO2",
  renal_dehydration: "Renal Ca2+",
  solar_storm: "X-Flare SPE",
};

const BIOMETRIC_SOURCE_LABEL: Record<BiometricSourceType, string> = {
  astroskin_stream: "CSA ASTROSKIN 1HZ",
  web_bluetooth: "WEB BLUETOOTH GATT",
  webcam_rppg: "WEBCAM rPPG PULSE",
  external_api: "CHP-IDA API INGEST",
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

function MiniSparkline({
  values,
  strokeHex,
}: {
  values: number[];
  strokeHex: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 68;
  const h = 18;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[18px] w-[58px] shrink-0 xl:w-[68px]"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeHex}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export default function HomePage() {
  const initialScenario = DEMO_SCENARIOS[0];

  const [envId, setEnvId] = useState<MissionEnvironmentId>(
    initialScenario.environmentId
  );
  const [activeScenarioId, setActiveScenarioId] = useState<
    ScenarioId | "custom"
  >(initialScenario.id);
  const [telemetryMode, setTelemetryMode] = useState<TelemetryMode>("preset");
  const [biometricSource, setBiometricSource] =
    useState<BiometricSourceType>("astroskin_stream");

  const [presetVitals, setPresetVitals] = useState<VitalReadings>(
    initialScenario.vitals
  );
  const [presetEnv, setPresetEnv] = useState<EnvironmentTelemetry>(
    initialScenario.envTelemetry
  );

  const [liveVitals, setLiveVitals] = useState<VitalReadings>(
    initialScenario.vitals
  );
  const [liveEnv, setLiveEnv] = useState<EnvironmentTelemetry>(
    MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry
  );
  const [countermeasureVitalsPatch, setCountermeasureVitalsPatch] = useState<
    Partial<VitalReadings>
  >({});
  const [countermeasureEnvPatch, setCountermeasureEnvPatch] = useState<
    Partial<EnvironmentTelemetry>
  >({});

  const [issSnapshot, setIssSnapshot] =
    useState<IssLiveTelemetrySnapshot | null>(null);
  const [isRefreshingIss, setIsRefreshingIss] = useState<boolean>(false);
  const [osdrStudies, setOsdrStudies] = useState<OsdrStudyLiveMetadata[]>([
    CURATED_OSDR_STUDIES["OSD-48"],
    CURATED_OSDR_STUDIES["OSD-104"],
    CURATED_OSDR_STUDIES["OSD-530"],
  ]);
  const [isRefreshingOsdr, setIsRefreshingOsdr] = useState<boolean>(false);

  const [selectedSystem, setSelectedSystem] = useState<BodySystemId>(
    initialScenario.focusSystem
  );
  const [selectedSubStructure, setSelectedSubStructure] =
    useState<SelectedSubStructure | null>(null);
  const [examFindings, setExamFindings] = useState<
    Record<string, ExamStepFinding>
  >({});
  const [executedActions, setExecutedActions] = useState<ExecutedActionLog[]>(
    []
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
    if (surfaceMode !== "console") return;
    const frame = requestAnimationFrame(() => document.getElementById("cmo-console")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [surfaceMode]);
  const [activeDrawer, setActiveDrawer] = useState<
    "none" | "trends" | "routine" | "hardware"
  >("none");
  const [crewStore, setCrewStore] = useState<CrewProfilesStorageState>(
    createDefaultCrewProfilesState
  );
  const [crewMenuOpen, setCrewMenuOpen] = useState<boolean>(false);
  const crewMenuRef = useRef<HTMLDivElement | null>(null);
  const prevProfileSyncRef = useRef<string>(
    `${crewStore.activeProfileId}:${crewStore.profiles[0]?.missionAssignment ?? "iss_orbit"}`
  );
  const astroTickRef = useRef<number>(0);

  const refreshIssTelemetry = useCallback(async () => {
    setIsRefreshingIss(true);
    try {
      const snap = await fetchIssLiveSnapshot({
        tickSeed: astroTickRef.current,
      });
      setIssSnapshot(snap);
      setLiveEnv((prev) =>
        spaceWeather
          ? applySpaceWeatherToTelemetry(snap.mappedEnvTelemetry, spaceWeather)
          : {
              ...snap.mappedEnvTelemetry,
              solarFlareClass: prev.solarFlareClass,
            }
      );
    } finally {
      setIsRefreshingIss(false);
    }
  }, [spaceWeather]);

  const refreshOsdrStudies = useCallback(async () => {
    setIsRefreshingOsdr(true);
    try {
      const results = await Promise.all([
        fetchOsdrStudyMetadata("OSD-48"),
        fetchOsdrStudyMetadata("OSD-104"),
        fetchOsdrStudyMetadata("OSD-530"),
      ]);
      setOsdrStudies(results);
    } finally {
      setIsRefreshingOsdr(false);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("mode") === "console"
    ) {
      setSurfaceMode("console");
    }
    setRoutineProgress(loadRoutineProgress());
    const loaded = loadCrewProfilesState();
    setCrewStore(loaded);
    void refreshIssTelemetry();
  }, [refreshIssTelemetry]);

  useEffect(() => {
    const syncIfNewer = () => {
      const incoming = loadCrewProfilesState();
      setCrewStore((prev) => {
        const shouldAdopt =
          incoming.updatedAt > prev.updatedAt ||
          (prev.updatedAt === 0 &&
            incoming.updatedAt === 0 &&
            incoming.activeProfileId !== prev.activeProfileId);
        return shouldAdopt ? incoming : prev;
      });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CREW_PROFILE_STORAGE_KEY || e.key === null) {
        syncIfNewer();
      }
    };
    window.addEventListener("focus", syncIfNewer);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", syncIfNewer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const resetSessionInterventions = useCallback(() => {
    setExecutedActions([]);
    setCountermeasureVitalsPatch({});
    setCountermeasureEnvPatch({});
    setExamFindings({});
  }, []);

  useEffect(() => {
    const newlyActive =
      crewStore.profiles.find((p) => p.id === crewStore.activeProfileId) ??
      crewStore.profiles[0];
    const syncKey = newlyActive
      ? `${newlyActive.id}:${newlyActive.missionAssignment}`
      : crewStore.activeProfileId;
    if (prevProfileSyncRef.current !== syncKey) {
      prevProfileSyncRef.current = syncKey;
      if (newlyActive) {
        setEnvId(newlyActive.missionAssignment);
        if (telemetryMode === "preset") {
          setPresetEnv(
            MISSION_ENVIRONMENTS[newlyActive.missionAssignment].defaultTelemetry
          );
        }
      }
      resetSessionInterventions();
    }
  }, [
    crewStore.activeProfileId,
    crewStore.profiles,
    telemetryMode,
    resetSessionInterventions,
  ]);

  function handleSelectCrewProfile(profileId: string) {
    const selected = crewStore.profiles.find((p) => p.id === profileId);
    setCrewStore((prev) => {
      const next: CrewProfilesStorageState = {
        ...prev,
        activeProfileId: profileId,
        updatedAt: Date.now(),
      };
      saveCrewProfilesState(next);
      return next;
    });
    if (selected) {
      prevProfileSyncRef.current = `${selected.id}:${selected.missionAssignment}`;
      handleSelectEnvironment(selected.missionAssignment);
    }
    resetSessionInterventions();
    setCrewMenuOpen(false);
  }

  useEffect(() => {
    if (telemetryMode === "preset") return;
    if (biometricSource !== "astroskin_stream") return;

    const timer = setInterval(() => {
      astroTickRef.current += 1;
      setLiveVitals((prev) =>
        generateAstroskinTelemetryFrame(initialScenario.vitals, astroTickRef.current)
      );
      if (astroTickRef.current % 10 === 0) {
        void refreshIssTelemetry();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [telemetryMode, biometricSource, initialScenario.vitals, refreshIssTelemetry]);

  useEffect(() => {
    if (activeDrawer === "none") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveDrawer("none");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDrawer]);

  useEffect(() => {
    if (!crewMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        crewMenuRef.current &&
        !crewMenuRef.current.contains(e.target as Node)
      ) {
        setCrewMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCrewMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [crewMenuOpen]);

  const multiplexed = useMemo(
    () =>
      fuseTelemetryStreams({
        mode: telemetryMode,
        envId,
        activeScenarioId,
        presetVitals,
        presetEnv,
        liveVitals,
        liveEnv,
        countermeasureVitalsPatch,
        countermeasureEnvPatch,
      }),
    [
      telemetryMode,
      envId,
      activeScenarioId,
      presetVitals,
      presetEnv,
      liveVitals,
      liveEnv,
      countermeasureVitalsPatch,
      countermeasureEnvPatch,
    ]
  );

  const activeCrewProfile = useMemo(
    () =>
      crewStore.profiles.find((p) => p.id === crewStore.activeProfileId) ??
      crewStore.profiles[0],
    [crewStore]
  );

  const vitals = multiplexed.vitals;
  const envTelemetry = multiplexed.envTelemetry;

  const activeDrugIds = useMemo(
    () => executedActions.map((a) => a.actionId),
    [executedActions]
  );

  const evaluation = useMemo(
    () =>
      evaluateCrewHealth(vitals, envTelemetry, envId, activeCrewProfile, {
        activeDrugIds,
      }),
    [vitals, envTelemetry, envId, activeCrewProfile, activeDrugIds]
  );

  const envConfig = MISSION_ENVIRONMENTS[envId];
  const readinessStyle = READINESS_STATUS[evaluation.overallStatus];
  const history = BASE_14_SOL_HISTORY[envId];

  function handleSelectSystem(nextSystem: BodySystemId) {
    setSelectedSystem(nextSystem);
    setSelectedSubStructure((prev) =>
      prev && prev.systemId === nextSystem ? prev : null
    );
  }

  function handleSelectEnvironment(nextEnvId: MissionEnvironmentId) {
    setEnvId(nextEnvId);
    if (telemetryMode === "preset") {
      setActiveScenarioId("custom");
      const defaultEnvTelemetry = MISSION_ENVIRONMENTS[nextEnvId].defaultTelemetry;
      setPresetEnv(
        spaceWeather
          ? applySpaceWeatherToTelemetry(defaultEnvTelemetry, spaceWeather)
          : defaultEnvTelemetry
      );
    }
  }

  function handleSelectScenario(scenario: MissionScenario) {
    setActiveScenarioId(scenario.id);
    setEnvId(scenario.environmentId);
    setPresetVitals(scenario.vitals);
    setPresetEnv(scenario.envTelemetry);
    setCountermeasureVitalsPatch({});
    setCountermeasureEnvPatch({});
    setSelectedSystem(scenario.focusSystem);
    setSelectedSubStructure(null);
    setExamFindings({});
    setExecutedActions([]);
  }

  function handleUpdateVitals(patch: Partial<VitalReadings>) {
    setCountermeasureVitalsPatch((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch) as Array<keyof VitalReadings>) {
        delete next[k];
      }
      return next;
    });
    if (telemetryMode === "preset") {
      setActiveScenarioId("custom");
      setPresetVitals((prev) => clampVitalReadings({ ...prev, ...patch }));
    } else {
      setLiveVitals((prev) => clampVitalReadings({ ...prev, ...patch }));
    }
  }

  function handleUpdateEnvTelemetry(patch: Partial<EnvironmentTelemetry>) {
    setCountermeasureEnvPatch((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch) as Array<keyof EnvironmentTelemetry>) {
        delete next[k];
      }
      return next;
    });
    if (telemetryMode === "preset") {
      setActiveScenarioId("custom");
      setPresetEnv((prev) => ({ ...prev, ...patch }));
    } else {
      setLiveEnv((prev) => ({ ...prev, ...patch }));
    }
  }

  function handleLiveBiometricPatch(patch: Partial<VitalReadings>) {
    setLiveVitals((prev) => clampVitalReadings({ ...prev, ...patch }));
  }

  function handleChangeTelemetryMode(nextMode: TelemetryMode) {
    setTelemetryMode(nextMode);
    setCountermeasureVitalsPatch({});
    setCountermeasureEnvPatch({});
  }

  function handleUpdateExamFinding(stepKey: string, finding: ExamStepFinding) {
    setExamFindings((prev) => ({
      ...prev,
      [stepKey]: finding,
    }));
  }

  function handleResetSystemExam(systemId: BodySystemId) {
    setExamFindings((prev) => {
      const next = { ...prev };
      for (const step of BODY_SYSTEM_METADATA[systemId].selfExamSteps) {
        delete next[`${systemId}-${step.stepNumber}`];
      }
      return next;
    });
  }

  function handleExecuteCountermeasure(action: CountermeasureActionSpec) {
    const next = applyCountermeasureToState(
      vitals,
      envTelemetry,
      action,
      activeCrewProfile
    );
    const vitalsDiff: Partial<VitalReadings> = {};
    for (const key of Object.keys(next.vitals) as Array<keyof VitalReadings>) {
      if (next.vitals[key] !== vitals[key]) {
        (vitalsDiff as Record<string, unknown>)[key] = next.vitals[key];
      }
    }
    const envDiff: Partial<EnvironmentTelemetry> = {};
    for (const key of Object.keys(next.envTelemetry) as Array<
      keyof EnvironmentTelemetry
    >) {
      if (next.envTelemetry[key] !== envTelemetry[key]) {
        (envDiff as Record<string, unknown>)[key] = next.envTelemetry[key];
      }
    }
    if (Object.keys(vitalsDiff).length > 0) {
      setCountermeasureVitalsPatch((prev) => ({ ...prev, ...vitalsDiff }));
    }
    if (Object.keys(envDiff).length > 0) {
      setCountermeasureEnvPatch((prev) => ({ ...prev, ...envDiff }));
    }

    const now = new Date();
    const utc = `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes()
    ).padStart(2, "0")} UTC`;

    setExecutedActions((prev) => [
      ...prev,
      {
        id: `${action.id}-${now.getTime()}`,
        actionId: action.id,
        systemId: action.systemId,
        label: action.label,
        deltaSummary: action.deltaSummary,
        timestamp: utc,
      },
    ]);

    if (action.routineTaskId) {
      setRoutineProgress((prev) => {
        if (prev.completedTaskIds.includes(action.routineTaskId!)) {
          return prev;
        }
        const updated = toggleRoutineTask(
          prev,
          action.routineTaskId!,
          DEFAULT_ROUTINE_TASKS
        );
        saveRoutineProgress(updated);
        return updated;
      });
    }
  }

  async function handleSyncSpaceWeather() {
    if (isSyncingWeather) return;
    setIsSyncingWeather(true);
    try {
      const weather = await fetchSpaceWeatherAlert();
      setSpaceWeather(weather);
      if (telemetryMode === "preset") {
        setActiveScenarioId("custom");
        setPresetEnv((prev) =>
          applySpaceWeatherToTelemetry(
            {
              ...prev,
              dailyRadiationMsv: envConfig.defaultTelemetry.dailyRadiationMsv,
              saaOrSpeDoseMsv: envConfig.defaultTelemetry.saaOrSpeDoseMsv,
            },
            weather
          )
        );
      } else {
        setLiveEnv((prev) => applySpaceWeatherToTelemetry(prev, weather));
      }
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
    if (!slide.preserveActiveScenario) {
      setTelemetryMode("preset");
      const scenario = DEMO_SCENARIOS.find((s) => s.id === slide.scenarioId);
      if (scenario) {
        setActiveScenarioId(scenario.id);
        setEnvId(scenario.environmentId);
        setPresetVitals(scenario.vitals);
        setPresetEnv(scenario.envTelemetry);
        setCountermeasureVitalsPatch({});
        setCountermeasureEnvPatch({});
      }
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

  const telemetryStripChannels: Array<{
    id: string;
    label: string;
    valueDisplay: string;
    targetLabel: string;
    status: TriageStatus;
    sparkValues: number[];
    strokeHex: string;
    focusSystem: BodySystemId;
    onStep: (dir: -1 | 1) => void;
  }> = [
    {
      id: "hr",
      label: "Heart Rate",
      valueDisplay: `${vitals.heartRateBpm} bpm`,
      targetLabel: "52–88",
      status:
        vitals.heartRateBpm > 102 || vitals.heartRateBpm < 45
          ? "red"
          : vitals.heartRateBpm > 88 || vitals.heartRateBpm < 50
          ? "amber"
          : "green",
      sparkValues: [...history.map((p) => p.heartRateBpm), vitals.heartRateBpm],
      strokeHex: "#fb7185",
      focusSystem: "cardiovascular",
      onStep: (dir) =>
        handleUpdateVitals({ heartRateBpm: vitals.heartRateBpm + dir * 4 }),
    },
    {
      id: "bp",
      label: "BP mmHg",
      valueDisplay: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`,
      targetLabel: "<130/85",
      status:
        vitals.bloodPressureSystolic >= 140 ||
        vitals.bloodPressureDiastolic >= 90
          ? "red"
          : vitals.bloodPressureSystolic >= 130 ||
            vitals.bloodPressureDiastolic >= 85
          ? "amber"
          : "green",
      sparkValues: [
        ...history.map((p) => p.systolicBp),
        vitals.bloodPressureSystolic,
      ],
      strokeHex: "#f43f5e",
      focusSystem: envConfig.gravityG === 0 ? "neuro_ocular" : "cardiovascular",
      onStep: (dir) =>
        handleUpdateVitals({
          bloodPressureSystolic: vitals.bloodPressureSystolic + dir * 4,
          bloodPressureDiastolic: vitals.bloodPressureDiastolic + dir * 2,
        }),
    },
    {
      id: "co2",
      label: "Cabin pCO2",
      valueDisplay: `${envTelemetry.cabinCo2MmHg} mmHg`,
      targetLabel: "<=3.0",
      status:
        envTelemetry.cabinCo2MmHg > 4.0
          ? "red"
          : envTelemetry.cabinCo2MmHg > 3.2
          ? "amber"
          : "green",
      sparkValues: [
        ...history.map((p) => p.issCabinCo2MmHg),
        envTelemetry.cabinCo2MmHg,
      ],
      strokeHex: "#2dd4bf",
      focusSystem: "neuro_ocular",
      onStep: (dir) =>
        handleUpdateEnvTelemetry({
          cabinCo2MmHg: Number(
            Math.max(
              0.3,
              Math.min(8.0, envTelemetry.cabinCo2MmHg + dir * 0.3)
            ).toFixed(1)
          ),
        }),
    },
    {
      id: "rad",
      label: "RadLab",
      valueDisplay: `${envTelemetry.dailyRadiationMsv} mSv`,
      targetLabel:
        envTelemetry.solarFlareClass !== "None"
          ? `Flare ${envTelemetry.solarFlareClass}`
          : "<1.2/d",
      status:
        envTelemetry.solarFlareClass === "X" ||
        envTelemetry.dailyRadiationMsv >= 2.5
          ? "red"
          : envTelemetry.solarFlareClass === "M" ||
            envTelemetry.dailyRadiationMsv > 1.2
          ? "amber"
          : "green",
      sparkValues: [
        ...history.map((p) => p.totalRadiationMsv),
        envTelemetry.dailyRadiationMsv,
      ],
      strokeHex: "#c084fc",
      focusSystem: "immune_hematology",
      onStep: (dir) =>
        handleUpdateEnvTelemetry({
          dailyRadiationMsv: Number(
            Math.max(
              0.2,
              Math.min(10.0, envTelemetry.dailyRadiationMsv + dir * 0.25)
            ).toFixed(2)
          ),
        }),
    },
    {
      id: "h2o",
      label: "Hydration",
      valueDisplay: `${vitals.hydrationMl} mL`,
      targetLabel: ">=2400",
      status:
        vitals.hydrationMl < 1500
          ? "red"
          : vitals.hydrationMl < 2100
          ? "amber"
          : "green",
      sparkValues: [
        ...history.map((_, idx) => 2400 + ((idx % 3) - 1) * 90),
        vitals.hydrationMl,
      ],
      strokeHex: "#4ade80",
      focusSystem: "musculoskeletal_renal",
      onStep: (dir) =>
        handleUpdateVitals({ hydrationMl: vitals.hydrationMl + dir * 200 }),
    },
    {
      id: "slp",
      label: "Sleep",
      valueDisplay: `${vitals.sleepHours} hrs`,
      targetLabel: "6.5–8.0",
      status:
        vitals.sleepHours < 5.8
          ? "red"
          : vitals.sleepHours < 6.5
          ? "amber"
          : "green",
      sparkValues: [...history.map((p) => p.sleepHours), vitals.sleepHours],
      strokeHex: "#818cf8",
      focusSystem: "behavioral_circadian",
      onStep: (dir) =>
        handleUpdateVitals({
          sleepHours: Number((vitals.sleepHours + dir * 0.4).toFixed(1)),
        }),
    },
  ];

  const completedRoutineCount = routineProgress.completedTaskIds.length;

  const activeCrewShortName =
    activeCrewProfile.name.trim().split(" ").pop() ||
    activeCrewProfile.callsign;

  return (
    <div id="cmo-console" tabIndex={-1} className="ares-console-enter flex min-h-screen flex-col bg-[#0a0a0b] text-white outline-none lg:h-dvh lg:overflow-hidden">
      {/* ZONE A: Monochrome Top Command Bar */}
      <header className="shrink-0 border-b border-white/[0.06] bg-[#111113] px-3 py-1.5 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Brand Identity + Environment + Crew Menu + Pre-Flight Lab */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex shrink-0 items-center gap-1.5 pr-1">
              <svg
                viewBox="0 0 32 32"
                className="h-4.5 w-4.5 text-white"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 26L14.5 6H18.5L28 26H23.2L16.5 11.4L9.2 26H4Z"
                  fill="currentColor"
                />
                <path
                  d="M5 20.5C11.5 14 20.5 11 29 9.5"
                  stroke="#0d0d0f"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs font-semibold tracking-wider text-white">
                ARES-MED
              </span>
              <span className="hidden rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] text-[#71717a] 2xl:inline-block">
                SOL 42 · CMO
              </span>
            </div>

            <nav
              aria-label="Mission Environment Profile"
              className="flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-[#141416] p-0.5"
            >
              {ENVIRONMENT_ORDER.map((id) => {
                const env = MISSION_ENVIRONMENTS[id];
                const active = envId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={env.name}
                    onClick={() => handleSelectEnvironment(id)}
                    aria-pressed={active}
                    className={`inline-flex h-[26px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium transition ${
                      active
                        ? "bg-white text-[#0a0a0a]"
                        : "text-[#8b909a] hover:text-white"
                    }`}
                  >
                    <span>{ENV_SHORT_LABEL[id]}</span>
                    {env.autonomousModeRequired && (
                      <Radio
                        className={`h-2.5 w-2.5 ${
                          active ? "text-amber-600" : "text-amber-400"
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Compact Crew BioTwin Selector Popover + Pre-Flight Lab Link */}
            <div ref={crewMenuRef} className="relative flex items-center gap-1">
              <button
                type="button"
                data-testid="crew-selector-menu-btn"
                aria-expanded={crewMenuOpen}
                aria-haspopup="menu"
                onClick={() => setCrewMenuOpen((prev) => !prev)}
                title={`${activeCrewProfile.callsign} · ${activeCrewProfile.name} — ${activeCrewProfile.summaryTag}`}
                className={`inline-flex h-[30px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[10.5px] font-medium transition ${
                  crewMenuOpen
                    ? "border-white/25 bg-[#202024] text-white"
                    : "border-white/[0.08] bg-[#141416] text-[#e4e4e7] hover:border-white/20 hover:text-white"
                }`}
              >
                <UserCheck
                  className="h-3 w-3 shrink-0 text-[#a1a1aa]"
                  aria-hidden="true"
                />
                <span className="max-w-[88px] truncate">
                  {activeCrewShortName}
                </span>
                <ChevronDown
                  className={`h-3 w-3 text-[#71717a] transition-transform ${
                    crewMenuOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {crewMenuOpen && (
                <div
                  role="menu"
                  data-testid="crew-selector-popover"
                  className="absolute top-9 left-0 z-40 w-72 rounded-2xl border border-white/[0.09] bg-[#121214]/95 p-2 shadow-2xl backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between px-2 pb-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#71717a]">
                      Active Crew BioTwin ({crewStore.profiles.length})
                    </span>
                    <Link
                      href="/preflight"
                      onClick={() => setCrewMenuOpen(false)}
                      className="text-[10px] font-medium text-[#a1a1aa] hover:text-white"
                    >
                      Upload / Edit →
                    </Link>
                  </div>
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {crewStore.profiles.map((profile) => {
                      const isActive = profile.id === activeCrewProfile.id;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActive}
                          data-testid={`crew-persona-${profile.id}`}
                          onClick={() => handleSelectCrewProfile(profile.id)}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                            isActive
                              ? "bg-white/[0.09] text-white"
                              : "text-[#a1a1aa] hover:bg-white/[0.04] hover:text-white"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-white">
                              {profile.callsign} · {profile.name}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-[#71717a]">
                              {profile.summaryTag}
                            </p>
                          </div>
                          {isActive && (
                            <Check
                              className="h-3.5 w-3.5 shrink-0 text-white"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Link
                href="/preflight"
                data-testid="open-preflight-lab-link"
                title="Open NASA JSC Pre-Flight Bio-Twin Dossier & AI Lab"
                className="inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#141416] px-2.5 text-[10.5px] font-medium text-[#d4d4d8] transition hover:border-white/25 hover:bg-[#1a1a1e] hover:text-white"
              >
                <FlaskConical className="h-3 w-3 text-[#a1a1aa]" aria-hidden="true" />
                <span>Pre-Flight</span>
              </Link>
            </div>
          </div>

          {/* Right: Scenario Presets + Unified Console Tools Bar + Readiness */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              role="group"
              aria-label="Judge demo scenarios"
              className="flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-[#141416] p-0.5"
            >
              {DEMO_SCENARIOS.map((scenario) => {
                const isSelected = activeScenarioId === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    data-testid={`scenario-pill-${scenario.id}`}
                    onClick={() => handleSelectScenario(scenario)}
                    aria-pressed={isSelected}
                    className={`h-[26px] cursor-pointer whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium transition ${
                      isSelected
                        ? "bg-white text-[#0a0a0a]"
                        : "text-[#8b909a] hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {SCENARIO_SHORT_LABEL[scenario.id]}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-[#141416] p-0.5">
              <button
                type="button"
                data-testid="open-hardware-drawer"
                onClick={() =>
                  setActiveDrawer((prev) =>
                    prev === "hardware" ? "none" : "hardware"
                  )
                }
                aria-expanded={activeDrawer === "hardware"}
                className={`inline-flex h-[26px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium transition ${
                  activeDrawer === "hardware"
                    ? "bg-white text-[#0a0a0a]"
                    : telemetryMode !== "preset"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-[#d4d4d8] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Cpu className="h-3 w-3 opacity-80" aria-hidden="true" />
                <span>
                  {telemetryMode === "preset"
                    ? "Bridge"
                    : telemetryMode === "live_hardware"
                    ? "Live HW"
                    : "Hybrid"}
                </span>
                {telemetryMode !== "preset" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                data-testid="open-trends-drawer"
                onClick={() =>
                  setActiveDrawer((prev) =>
                    prev === "trends" ? "none" : "trends"
                  )
                }
                aria-expanded={activeDrawer === "trends"}
                className={`inline-flex h-[26px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium transition ${
                  activeDrawer === "trends"
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#d4d4d8] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <BarChart3 className="h-3 w-3 opacity-80" aria-hidden="true" />
                <span>Charts</span>
              </button>

              <button
                type="button"
                data-testid="open-routine-drawer"
                onClick={() =>
                  setActiveDrawer((prev) =>
                    prev === "routine" ? "none" : "routine"
                  )
                }
                aria-expanded={activeDrawer === "routine"}
                className={`inline-flex h-[26px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium transition ${
                  activeDrawer === "routine"
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#d4d4d8] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <ListChecks className="h-3 w-3 opacity-80" aria-hidden="true" />
                <span>
                  Routine {completedRoutineCount}/{DEFAULT_ROUTINE_TASKS.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSyncSpaceWeather}
                disabled={isSyncingWeather}
                title={spaceWeather?.summary ?? "Sync live NASA DONKI space weather"}
                className="inline-flex h-[26px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium text-[#d4d4d8] transition hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3 w-3 text-[#8b909a] ${
                    isSyncingWeather ? "animate-spin" : ""
                  }`}
                  aria-hidden="true"
                />
                <span>{isSyncingWeather ? "Sync" : "DONKI"}</span>
                {spaceWeather && (
                  <Sun
                    className={`h-3 w-3 ${
                      spaceWeather.isFallback
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSurfaceMode("presentation")}
                title="Return to 3D Presentation Slides"
                className="inline-flex h-[26px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10.5px] font-medium text-[#d4d4d8] transition hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="h-3 w-3 text-[#8b909a]" aria-hidden="true" />
                <span className="hidden xl:inline">Slides</span>
              </button>
            </div>

            <div
              data-testid="readiness-badge"
              className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-medium ${readinessStyle.badgeClass}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${readinessStyle.dotClass}`}
              />
              <span className="hidden 2xl:inline">Readiness</span>
              <span className="font-mono font-semibold tabular-nums">
                {evaluation.readinessScore}/100
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ZONE B: Full-Viewport Center 2-Column Console */}
      <main className="min-h-0 flex-1 overflow-y-auto p-2.5 lg:overflow-hidden lg:p-3">
        <ResizablePanels label="Resize BioTwin and CMO panels" defaultSize="66.6667%" minPrimary={560} minSecondary={340} className="ares-console-workspace">
          <div className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] lg:h-full">
            <BioTwinBodyMap
              assessments={evaluation.systems}
              cascades={evaluation.activeCascades}
              selectedSystem={selectedSystem}
              onSelectSystem={handleSelectSystem}
              onSelectSubStructure={setSelectedSubStructure}
              vitals={vitals}
              envTelemetry={envTelemetry}
              telemetryMode={telemetryMode}
              hardwareSourceLabel={`${BIOMETRIC_SOURCE_LABEL[biometricSource]} / ISS ETHOS`}
            />
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] lg:h-full">
            <AutonomousCmoPanel
              selectedSystem={selectedSystem}
              evaluation={evaluation}
              vitals={vitals}
              envTelemetry={envTelemetry}
              envId={envId}
              selectedSubStructure={selectedSubStructure}
              onClearSubStructure={() => setSelectedSubStructure(null)}
              onExecuteCountermeasure={handleExecuteCountermeasure}
              executedActions={executedActions}
              onOcularFindingChange={(ocularFinding) =>
                handleUpdateVitals({ ocularFinding })
              }
              examFindings={examFindings}
              onUpdateExamFinding={handleUpdateExamFinding}
              onResetSystemExam={handleResetSystemExam}
              telemetryMode={telemetryMode}
              biometricSource={biometricSource}
              issSnapshot={issSnapshot}
              crewProfile={activeCrewProfile}
              inferenceMode={crewStore.inferenceConfig.mode}
              inferenceConfig={crewStore.inferenceConfig}
            />
          </div>
        </ResizablePanels>
      </main>

      {/* ZONE C: Persistent 6-Channel Bottom Telemetry Dock */}
      <footer
        aria-label="Live physiological and environmental telemetry strip"
        className="shrink-0 border-t border-white/[0.06] bg-[#111113] px-3 py-1.5 lg:px-4"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {telemetryStripChannels.map((ch) => {
            const isSelected = selectedSystem === ch.focusSystem;
            const dotColor =
              ch.status === "red"
                ? "bg-rose-400"
                : ch.status === "amber"
                ? "bg-amber-400"
                : "bg-emerald-400";

            return (
              <div
                key={ch.id}
                onClick={() => handleSelectSystem(ch.focusSystem)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectSystem(ch.focusSystem);
                  }
                }}
                className={`flex min-w-0 cursor-pointer flex-col justify-between rounded-xl border px-2.5 py-1.5 transition ${
                  isSelected
                    ? "border-white/20 bg-[#1c1c1f]"
                    : "border-white/[0.06] bg-[#151517] hover:border-white/15 hover:bg-[#1a1a1d]"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                    <span className="truncate text-[10px] font-medium uppercase tracking-wider text-[#8b909a]">
                      {ch.label}
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-white">
                    {ch.valueDisplay}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <MiniSparkline
                      values={ch.sparkValues}
                      strokeHex={ch.strokeHex}
                    />
                    <span className="hidden truncate font-mono text-[9px] text-[#71717a] 2xl:inline">
                      {ch.targetLabel}
                    </span>
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => ch.onStep(-1)}
                      aria-label={`Decrease ${ch.label}`}
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/[0.08] bg-[#18181b] text-[#9ea3ae] transition hover:border-white/25 hover:text-white"
                    >
                      <Minus className="h-2.5 w-2.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => ch.onStep(1)}
                      aria-label={`Increase ${ch.label}`}
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/[0.08] bg-[#18181b] text-[#9ea3ae] transition hover:border-white/25 hover:text-white"
                    >
                      <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-center font-mono text-[9.5px] text-[#52525b]">
          ARES-TWIN/1.0 · Synthetic demonstration profiles — educational simulation, not medical advice.
        </p>
      </footer>

      {/* Non-Blocking Right Slide-Over Drawers */}
      {activeDrawer !== "none" && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px]"
          onClick={() => setActiveDrawer("none")}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={
              activeDrawer === "trends"
                ? "Vitals Simulator and 14-Sol Telemetry Trends"
                : activeDrawer === "hardware"
                ? "Live ISS Telemetry and Biometric Hardware Bridge"
                : "Crew Countermeasure Routine and NASA Citations"
            }
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[640px] flex-col border-l border-white/10 bg-[#0e0e10] shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#a1a1aa]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-white">
                  {activeDrawer === "trends"
                    ? "Telemetry Simulator & 14-Sol Trends"
                    : activeDrawer === "hardware"
                    ? "Live ISS Telemetry & Biometric Hardware Bridge"
                    : "Crew Countermeasure Routine & NASA Sources"}
                </h2>
              </div>
              <button
                type="button"
                data-testid="close-drawer-btn"
                onClick={() => setActiveDrawer("none")}
                aria-label="Close drawer"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/[0.08] bg-[#18181b] text-[#9ea3ae] hover:border-white/25 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {activeDrawer === "trends" ? (
                <div className="space-y-5">
                  <VitalsInputPanel
                    vitals={vitals}
                    envTelemetry={envTelemetry}
                    envId={envId}
                    onUpdateVitals={handleUpdateVitals}
                    onUpdateEnvTelemetry={handleUpdateEnvTelemetry}
                  />
                  <TelemetryCharts
                    history={history}
                    currentVitals={vitals}
                    currentEnvTelemetry={envTelemetry}
                    envId={envId}
                  />
                </div>
              ) : activeDrawer === "hardware" ? (
                <HardwareBridgeDrawer
                  telemetryMode={telemetryMode}
                  onChangeTelemetryMode={handleChangeTelemetryMode}
                  biometricSource={biometricSource}
                  onChangeBiometricSource={setBiometricSource}
                  liveVitals={liveVitals}
                  onLiveBiometricPatch={handleLiveBiometricPatch}
                  faultDeltaSummary={multiplexed.faultDeltaSummary}
                  issSnapshot={issSnapshot}
                  isRefreshingIss={isRefreshingIss}
                  onRefreshIss={() => void refreshIssTelemetry()}
                  osdrStudies={osdrStudies}
                  onRefreshOsdr={() => void refreshOsdrStudies()}
                  isRefreshingOsdr={isRefreshingOsdr}
                />
              ) : (
                <div className="space-y-5">
                  <RoutineGamificationBar
                    tasks={DEFAULT_ROUTINE_TASKS}
                    progress={routineProgress}
                    onToggleTask={(taskId) => {
                      handleToggleRoutineTask(taskId);
                    }}
                    onResetDay={handleResetRoutineDay}
                    onSelectSystem={(sys) => {
                      handleSelectSystem(sys);
                      setActiveDrawer("none");
                    }}
                  />

                  <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
                        NASA HRP · OSDR · CSA Open References
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Cited in Protocol
                      </span>
                    </div>
                    <div className="space-y-2">
                      {OFFICIAL_CHALLENGE_LINKS.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#1b1b1b] px-3 py-2 text-xs text-[#9ea3ae] transition hover:border-white/25 hover:text-white"
                        >
                          <span className="truncate">{link.label}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/[0.07] pt-3">
                      {envConfig.activeHazards.map((hazardId) => {
                        const hazard = NASA_HAZARDS[hazardId];
                        return (
                          <a
                            key={hazardId}
                            href={hazard.referenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-white/10 bg-[#1b1b1b] px-2.5 py-1 text-[10.5px] text-[#9ea3ae] hover:text-white"
                          >
                            {hazard.shortLabel} ×
                            {envConfig.hazardWeights[hazardId].toFixed(1)}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

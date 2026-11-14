import { DEMO_SCENARIOS, MISSION_ENVIRONMENTS } from "@/data/nasaHrpData";
import { clampVitalReadings } from "@/lib/triageEngine";
import type {
  EnvironmentTelemetry,
  MissionEnvironmentId,
  ScenarioId,
  TelemetryMode,
  VitalReadings,
} from "@/types/health";

export interface MultiplexTelemetryInput {
  mode: TelemetryMode;
  envId: MissionEnvironmentId;
  activeScenarioId: ScenarioId | "custom";
  presetVitals: VitalReadings;
  presetEnv: EnvironmentTelemetry;
  liveVitals: VitalReadings;
  liveEnv: EnvironmentTelemetry;
  countermeasureVitalsPatch?: Partial<VitalReadings>;
  countermeasureEnvPatch?: Partial<EnvironmentTelemetry>;
}

export interface MultiplexTelemetryOutput {
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
  modeLabel: string;
  faultDeltaSummary: string[];
}

function projectEnvToMission(
  liveEnv: EnvironmentTelemetry,
  envId: MissionEnvironmentId
): EnvironmentTelemetry {
  if (envId === "iss_orbit") {
    return { ...liveEnv };
  }
  const targetEnv = MISSION_ENVIRONMENTS[envId].defaultTelemetry;
  // Scale ambient GCR to the selected planetary/deep-space profile while preserving live cabin/flare events
  const gcrDoseMsv = targetEnv.gcrDoseMsv;
  const saaOrSpeDoseMsv = Number(
    Math.max(liveEnv.saaOrSpeDoseMsv, targetEnv.saaOrSpeDoseMsv).toFixed(2)
  );
  return {
    ...liveEnv,
    gcrDoseMsv,
    saaOrSpeDoseMsv,
    dailyRadiationMsv: Number((gcrDoseMsv + saaOrSpeDoseMsv).toFixed(2)),
  };
}

function applySafeEnvClamps(env: EnvironmentTelemetry): EnvironmentTelemetry {
  return {
    ...env,
    cabinCo2MmHg: Number(Math.min(15.0, Math.max(0.2, env.cabinCo2MmHg)).toFixed(2)),
    cabinTempC: Number(Math.min(40.0, Math.max(10.0, env.cabinTempC)).toFixed(1)),
    cabinHumidityPct: Math.round(Math.min(95, Math.max(10, env.cabinHumidityPct))),
    gcrDoseMsv: Number(Math.max(0, env.gcrDoseMsv).toFixed(2)),
    saaOrSpeDoseMsv: Number(Math.max(0, env.saaOrSpeDoseMsv).toFixed(2)),
    dailyRadiationMsv: Number(Math.max(0, env.dailyRadiationMsv).toFixed(2)),
  };
}

/**
 * Combines live hardware telemetry (CSA Astroskin / BLE / Webcam rPPG + ISS ETHOS)
 * with deterministic scenarios and closed-loop countermeasure patches across 3 modes:
 * - "preset": Deterministic simulation preset
 * - "live_hardware": 100% live biometrics + live ISS/DONKI projected to mission env
 * - "hybrid_overlay": Live person biometrics + Scenario Fault Delta + Executed Countermeasures
 */
export function fuseTelemetryStreams(
  input: MultiplexTelemetryInput
): MultiplexTelemetryOutput {
  if (input.mode === "preset") {
    return {
      vitals: clampVitalReadings({
        ...input.presetVitals,
        ...(input.countermeasureVitalsPatch ?? {}),
      }),
      envTelemetry: applySafeEnvClamps({
        ...input.presetEnv,
        ...(input.countermeasureEnvPatch ?? {}),
      }),
      modeLabel: "SIMULATION PRESET",
      faultDeltaSummary: [],
    };
  }

  const baseLiveEnv = projectEnvToMission(input.liveEnv, input.envId);

  if (input.mode === "live_hardware") {
    return {
      vitals: clampVitalReadings({
        ...input.liveVitals,
        ...(input.countermeasureVitalsPatch ?? {}),
      }),
      envTelemetry: applySafeEnvClamps({
        ...baseLiveEnv,
        ...(input.countermeasureEnvPatch ?? {}),
      }),
      modeLabel: "LIVE HARDWARE STREAM",
      faultDeltaSummary: [],
    };
  }

  // Hybrid Fault-Overlay mode: preserve live crew biometrics, inject selected fault delta, then apply countermeasures
  let overlayVitals: VitalReadings = { ...input.liveVitals };
  let overlayEnv: EnvironmentTelemetry = { ...baseLiveEnv };
  const faultDeltaSummary: string[] = [];

  if (
    input.activeScenarioId !== "nominal" &&
    input.activeScenarioId !== "custom"
  ) {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === input.activeScenarioId);
    if (scenario) {
      if (scenario.id === "sans_co2_fluid_shift") {
        const nextCo2 = Number(
          Math.max(4.2, overlayEnv.cabinCo2MmHg + 1.4).toFixed(2)
        );
        const nextSys = Math.max(138, overlayVitals.bloodPressureSystolic + 20);
        const nextDia = Math.max(88, overlayVitals.bloodPressureDiastolic + 12);
        overlayEnv = {
          ...overlayEnv,
          cabinCo2MmHg: nextCo2,
          cabinTempC: Number((overlayEnv.cabinTempC + 1.2).toFixed(1)),
          cabinHumidityPct: overlayEnv.cabinHumidityPct + 8,
        };
        overlayVitals = {
          ...overlayVitals,
          bloodPressureSystolic: nextSys,
          bloodPressureDiastolic: nextDia,
          sleepHours: Math.min(overlayVitals.sleepHours, 6.4),
          ocularFinding: "blurry_near",
        };
        faultDeltaSummary.push(
          "CO2 +1.4 mmHg (CDRA Fault)",
          "BP +20/+12 mmHg (0g Shift)",
          "Ocular: Near Blur"
        );
      } else if (scenario.id === "renal_dehydration") {
        overlayVitals = {
          ...overlayVitals,
          hydrationMl: Math.min(
            1200,
            Math.max(800, overlayVitals.hydrationMl - 1350)
          ),
          aredExerciseCompleted: false,
          sleepHours: Math.min(
            5.7,
            Number((overlayVitals.sleepHours - 1.6).toFixed(1))
          ),
          moodScore: Math.min(4, Math.max(1, overlayVitals.moodScore - 3)),
          bloodGlucoseMgDl: Math.max(116, overlayVitals.bloodGlucoseMgDl + 24),
        };
        overlayEnv = {
          ...overlayEnv,
          cabinCo2MmHg: Number(
            Math.max(3.3, overlayEnv.cabinCo2MmHg + 0.4).toFixed(2)
          ),
        };
        faultDeltaSummary.push(
          "Hydration -1,350 mL (WRS Fault)",
          "ARED Unloaded",
          "Sleep -1.6h · Glucose +24 mg/dL"
        );
      } else if (scenario.id === "solar_storm") {
        const nextSpe = Number(
          Math.max(2.3, overlayEnv.saaOrSpeDoseMsv + 2.08).toFixed(2)
        );
        overlayEnv = {
          ...overlayEnv,
          solarFlareClass: "X",
          saaOrSpeDoseMsv: nextSpe,
          dailyRadiationMsv: Number((overlayEnv.gcrDoseMsv + nextSpe).toFixed(2)),
        };
        overlayVitals = {
          ...overlayVitals,
          sleepHours: Math.min(5.8, overlayVitals.sleepHours),
          moodScore: Math.min(5, overlayVitals.moodScore),
          bodyTempC: Number(
            Math.max(37.9, overlayVitals.bodyTempC + 1.0).toFixed(1)
          ),
        };
        faultDeltaSummary.push(
          "X-Flare SPE +2.08 mSv/day",
          "Core Temp +1.0 °C",
          "Sleep <= 5.8h"
        );
      }
    }
  }

  // Apply closed-loop countermeasure patches AFTER fault injection so Stage 3 interventions resolve the drill
  const finalVitals = clampVitalReadings({
    ...overlayVitals,
    ...(input.countermeasureVitalsPatch ?? {}),
  });
  const finalEnv = applySafeEnvClamps({
    ...overlayEnv,
    ...(input.countermeasureEnvPatch ?? {}),
  });

  return {
    vitals: finalVitals,
    envTelemetry: finalEnv,
    modeLabel: "HYBRID FAULT OVERLAY",
    faultDeltaSummary,
  };
}

import { describe, expect, it } from "vitest";
import {
  DEMO_SCENARIOS,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
} from "@/data/nasaHrpData";
import {
  applyCountermeasureToState,
  clampVitalReadings,
  evaluateCrewHealth,
  formatFlightSurgeonPacket,
} from "@/lib/triageEngine";
import type { BodySystemId, VitalReadings } from "@/types/health";

function getScenario(id: string) {
  const found = DEMO_SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`Missing demo scenario: ${id}`);
  return found;
}

describe("triageEngine", () => {
  it("evaluates nominal ISS routine with all 6 systems green, zero cascades, and readinessScore >= 85", () => {
    const nominal = getScenario("nominal");
    const result = evaluateCrewHealth(
      nominal.vitals,
      nominal.envTelemetry,
      "iss_orbit"
    );

    const systemIds = Object.keys(result.systems) as BodySystemId[];
    expect(systemIds).toHaveLength(6);
    for (const id of systemIds) {
      expect(result.systems[id].status).toBe("green");
    }
    expect(result.activeCascades).toHaveLength(0);
    expect(result.readinessScore).toBeGreaterThanOrEqual(85);
    expect(result.overallStatus).toBe("green");
    expect(result.autonomousTriageRequired).toBe(false);
    expect(result.flightSurgeonAlertRequired).toBe(false);
  });

  it("triggers gravity_fluid_sans cascade and elevates neuro_ocular to red on SANS + high CO2 scenario", () => {
    const sans = getScenario("sans_co2_fluid_shift");
    const result = evaluateCrewHealth(
      sans.vitals,
      sans.envTelemetry,
      "iss_orbit"
    );

    const cascade = result.activeCascades.find(
      (c) => c.id === "gravity_fluid_sans"
    );
    expect(cascade).toBeDefined();
    expect(cascade?.fromSystem).toBe("cardiovascular");
    expect(cascade?.toSystem).toBe("neuro_ocular");
    expect(result.systems.neuro_ocular.status).toBe("red");
    expect(result.flightSurgeonAlertRequired).toBe(true);
  });

  it("triggers bone_calcium_renal cascade and marks musculoskeletal_renal red in Mars transit dehydration", () => {
    const renal = getScenario("renal_dehydration");
    const result = evaluateCrewHealth(
      renal.vitals,
      renal.envTelemetry,
      "mars_transit"
    );

    const cascade = result.activeCascades.find(
      (c) => c.id === "bone_calcium_renal"
    );
    expect(cascade).toBeDefined();
    expect(cascade?.severity).toBe("red");
    expect(result.systems.musculoskeletal_renal.status).toBe("red");
    expect(result.autonomousTriageRequired).toBe(true);
  });

  it("triggers radiation_sleep_immune cascade and marks immune_hematology red during solar storm", () => {
    const storm = getScenario("solar_storm");
    const result = evaluateCrewHealth(
      storm.vitals,
      storm.envTelemetry,
      "lunar_rover"
    );

    const cascade = result.activeCascades.find(
      (c) => c.id === "radiation_sleep_immune"
    );
    expect(cascade).toBeDefined();
    expect(cascade?.fromSystem).toBe("behavioral_circadian");
    expect(cascade?.toSystem).toBe("immune_hematology");
    expect(result.systems.immune_hematology.status).toBe("red");
    expect(result.flightSurgeonAlertRequired).toBe(true);
  });

  it("triggers stress_glucose_metabolic cascade when sleep <= 5.5, mood <= 3, and blood glucose > 110 mg/dL", () => {
    const nominal = getScenario("nominal");
    const stressedVitals: VitalReadings = {
      ...nominal.vitals,
      sleepHours: 5.5,
      moodScore: 3,
      bloodGlucoseMgDl: 128,
    };

    const result = evaluateCrewHealth(
      stressedVitals,
      nominal.envTelemetry,
      "iss_orbit"
    );

    const cascade = result.activeCascades.find(
      (c) => c.id === "stress_glucose_metabolic"
    );
    expect(cascade).toBeDefined();
    expect(cascade?.fromSystem).toBe("behavioral_circadian");
    expect(cascade?.toSystem).toBe("metabolic_endocrine");
    expect(result.systems.metabolic_endocrine.status).not.toBe("green");
    expect(result.systems.behavioral_circadian.status).toBe("red");
  });

  it("clamps NaN, negative, and extreme out-of-bounds vital readings safely without NaN outputs", () => {
    const extremeVitals: VitalReadings = {
      bloodPressureSystolic: -50,
      bloodPressureDiastolic: 999,
      heartRateBpm: -20,
      bloodGlucoseMgDl: Number.NaN,
      bodyTempC: Number.POSITIVE_INFINITY,
      sleepHours: 99,
      moodScore: -5,
      hydrationMl: -300,
      ocularFinding: "clear",
      aredExerciseCompleted: false,
    };

    const clamped = clampVitalReadings(extremeVitals);
    expect(clamped.heartRateBpm).toBeGreaterThanOrEqual(30);
    expect(clamped.bloodPressureSystolic).toBeGreaterThanOrEqual(60);
    expect(clamped.bloodPressureDiastolic).toBeLessThanOrEqual(140);
    expect(Number.isFinite(clamped.bloodGlucoseMgDl)).toBe(true);
    expect(Number.isFinite(clamped.bodyTempC)).toBe(true);
    expect(clamped.sleepHours).toBeLessThanOrEqual(16);
    expect(clamped.moodScore).toBeGreaterThanOrEqual(1);
    expect(clamped.hydrationMl).toBeGreaterThanOrEqual(0);

    const result = evaluateCrewHealth(
      extremeVitals,
      MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
      "iss_orbit"
    );
    expect(Number.isFinite(result.readinessScore)).toBe(true);
    expect(result.readinessScore).toBeGreaterThanOrEqual(0);
    expect(result.readinessScore).toBeLessThanOrEqual(100);
  });

  it("reflects mission environment sensitivity between iss_orbit and mars_transit for identical borderline inputs", () => {
    const nominal = getScenario("nominal");
    const borderlineVitals: VitalReadings = {
      ...nominal.vitals,
      hydrationMl: 2050,
      sleepHours: 6.3,
      moodScore: 6,
    };
    const borderlineEnv = {
      ...MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
      dailyRadiationMsv: 1.3,
      cabinCo2MmHg: 3.1,
    };

    const issResult = evaluateCrewHealth(
      borderlineVitals,
      borderlineEnv,
      "iss_orbit"
    );
    const marsResult = evaluateCrewHealth(
      borderlineVitals,
      borderlineEnv,
      "mars_transit"
    );

    expect(issResult.autonomousTriageRequired).toBe(false);
    expect(marsResult.autonomousTriageRequired).toBe(true);
    expect(marsResult.readinessScore).toBeLessThan(issResult.readinessScore);

    const packet = formatFlightSurgeonPacket(
      marsResult,
      borderlineVitals,
      borderlineEnv,
      "mars_transit"
    );
    expect(packet).toContain("Deep-Space Mars Transit");
    expect(packet).toContain("14m 20s");
    expect(packet).toContain("AUTONOMOUS CMO");
  });

  it("recovers neuro_ocular, musculoskeletal_renal, and immune_hematology via closed-loop countermeasures", () => {
    const sans = getScenario("sans_co2_fluid_shift");
    const initialSans = evaluateCrewHealth(
      sans.vitals,
      sans.envTelemetry,
      sans.environmentId
    );
    expect(initialSans.systems.neuro_ocular.status).toBe("red");

    let state = { vitals: sans.vitals, envTelemetry: sans.envTelemetry };
    for (const action of EXECUTABLE_COUNTERMEASURES.neuro_ocular) {
      state = applyCountermeasureToState(state.vitals, state.envTelemetry, action);
    }
    const recoveredSans = evaluateCrewHealth(
      state.vitals,
      state.envTelemetry,
      sans.environmentId
    );
    expect(recoveredSans.systems.neuro_ocular.status).toBe("green");
    expect(recoveredSans.readinessScore).toBeGreaterThan(
      initialSans.readinessScore
    );

    const renal = getScenario("renal_dehydration");
    const initialRenal = evaluateCrewHealth(
      renal.vitals,
      renal.envTelemetry,
      renal.environmentId
    );
    expect(initialRenal.systems.musculoskeletal_renal.status).toBe("red");

    let renalState = { vitals: renal.vitals, envTelemetry: renal.envTelemetry };
    for (const action of EXECUTABLE_COUNTERMEASURES.musculoskeletal_renal) {
      renalState = applyCountermeasureToState(
        renalState.vitals,
        renalState.envTelemetry,
        action
      );
    }
    const recoveredRenal = evaluateCrewHealth(
      renalState.vitals,
      renalState.envTelemetry,
      renal.environmentId
    );
    expect(recoveredRenal.systems.musculoskeletal_renal.status).toBe("green");

    const storm = getScenario("solar_storm");
    const initialStorm = evaluateCrewHealth(
      storm.vitals,
      storm.envTelemetry,
      storm.environmentId
    );
    expect(initialStorm.systems.immune_hematology.status).toBe("red");

    let stormState = { vitals: storm.vitals, envTelemetry: storm.envTelemetry };
    for (const action of EXECUTABLE_COUNTERMEASURES.immune_hematology) {
      stormState = applyCountermeasureToState(
        stormState.vitals,
        stormState.envTelemetry,
        action
      );
    }
    const recoveredStorm = evaluateCrewHealth(
      stormState.vitals,
      stormState.envTelemetry,
      storm.environmentId
    );
    expect(recoveredStorm.systems.immune_hematology.status).toBe("green");
  });

  it("appends verified self-exam findings, sub-structure focus, and executed countermeasures to DTN packet when context provided", () => {
    const sans = getScenario("sans_co2_fluid_shift");
    const evalResult = evaluateCrewHealth(
      sans.vitals,
      sans.envTelemetry,
      "mars_transit"
    );
    const packet = formatFlightSurgeonPacket(
      evalResult,
      sans.vitals,
      sans.envTelemetry,
      "mars_transit",
      {
        subStructure: {
          systemId: "neuro_ocular",
          nodeName: "Organ_neuro_ocular__Core__Neural_Parenchyma__Eye_Left",
          displayLabel: "Eye Left",
          layer: "Core",
          tissueTag: "Neural Parenchyma",
        },
        examFindings: {
          "neuro_ocular-2": {
            status: "escalated",
            measuredValue: "5.9 mm",
            note: "Distended ONSD (> 5.5 mm)",
          },
        },
        executedActions: [
          {
            id: "log-1",
            actionId: "neuro_lbnp_cuffs",
            systemId: "neuro_ocular",
            label: "Engage LBNP Chibis / Venous Thigh Cuffs (30 min)",
            deltaSummary: "BP -> 120/78",
            timestamp: "14:15 UTC",
          },
        ],
      }
    );

    expect(packet).toContain("[PINNED 3D ANATOMICAL FOCUS]");
    expect(packet).toContain("Eye Left (Core · Neural Parenchyma)");
    expect(packet).toContain("[CMO GUIDED SELF-EXAM LOG]");
    expect(packet).toContain("ESCALATED [5.9 mm]");
    expect(packet).toContain("[EXECUTED COUNTERMEASURES]");
    expect(packet).toContain("Engage LBNP Chibis / Venous Thigh Cuffs");
  });
});

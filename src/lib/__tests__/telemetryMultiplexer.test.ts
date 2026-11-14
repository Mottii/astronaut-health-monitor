import { describe, expect, it } from "vitest";
import {
  DEMO_SCENARIOS,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
} from "@/data/nasaHrpData";
import { fuseTelemetryStreams } from "@/lib/telemetryMultiplexer";
import { evaluateCrewHealth } from "@/lib/triageEngine";

describe("telemetryMultiplexer", () => {
  const nominal = DEMO_SCENARIOS[0];

  it("returns preset telemetry cleanly in preset mode", () => {
    const sans = DEMO_SCENARIOS.find((s) => s.id === "sans_co2_fluid_shift")!;
    const out = fuseTelemetryStreams({
      mode: "preset",
      envId: "iss_orbit",
      activeScenarioId: "sans_co2_fluid_shift",
      presetVitals: sans.vitals,
      presetEnv: sans.envTelemetry,
      liveVitals: { ...nominal.vitals, heartRateBpm: 77 },
      liveEnv: MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
    });

    expect(out.modeLabel).toBe("SIMULATION PRESET");
    expect(out.vitals.heartRateBpm).toBe(sans.vitals.heartRateBpm);
    expect(out.envTelemetry.cabinCo2MmHg).toBe(sans.envTelemetry.cabinCo2MmHg);
    expect(out.faultDeltaSummary).toHaveLength(0);
  });

  it("projects live hardware biometrics and ISS telemetry across environments in live_hardware mode", () => {
    const out = fuseTelemetryStreams({
      mode: "live_hardware",
      envId: "mars_transit",
      activeScenarioId: "nominal",
      presetVitals: nominal.vitals,
      presetEnv: nominal.envTelemetry,
      liveVitals: { ...nominal.vitals, heartRateBpm: 79 },
      liveEnv: MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
    });

    expect(out.modeLabel).toBe("LIVE HARDWARE STREAM");
    expect(out.vitals.heartRateBpm).toBe(79);
    // Mars transit GCR baseline is 1.45 mSv/day
    expect(out.envTelemetry.gcrDoseMsv).toBe(1.45);
    expect(out.envTelemetry.dailyRadiationMsv).toBeGreaterThan(1.5);
  });

  it("preserves live person heart rate while injecting SANS + CO2 fault delta and clearing via countermeasures in hybrid_overlay mode", () => {
    const livePersonVitals = { ...nominal.vitals, heartRateBpm: 75 };
    const liveIssEnv = MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry;

    const faulted = fuseTelemetryStreams({
      mode: "hybrid_overlay",
      envId: "iss_orbit",
      activeScenarioId: "sans_co2_fluid_shift",
      presetVitals: nominal.vitals,
      presetEnv: nominal.envTelemetry,
      liveVitals: livePersonVitals,
      liveEnv: liveIssEnv,
    });

    expect(faulted.modeLabel).toBe("HYBRID FAULT OVERLAY");
    // Live person's 75 bpm heartbeat stays live
    expect(faulted.vitals.heartRateBpm).toBe(75);
    // Fault delta pushed CO2 >= 4.2 and ocular to blurry_near
    expect(faulted.envTelemetry.cabinCo2MmHg).toBeGreaterThanOrEqual(4.2);
    expect(faulted.vitals.ocularFinding).toBe("blurry_near");
    expect(faulted.faultDeltaSummary.length).toBeGreaterThan(0);

    const faultEval = evaluateCrewHealth(
      faulted.vitals,
      faulted.envTelemetry,
      "iss_orbit"
    );
    expect(faultEval.systems.neuro_ocular.status).toBe("red");

    // Apply Stage 3 neuro_ocular countermeasures on top of the hybrid stream
    const lbnp = EXECUTABLE_COUNTERMEASURES.neuro_ocular[0];
    const cdra = EXECUTABLE_COUNTERMEASURES.neuro_ocular[1];
    const recovered = fuseTelemetryStreams({
      mode: "hybrid_overlay",
      envId: "iss_orbit",
      activeScenarioId: "sans_co2_fluid_shift",
      presetVitals: nominal.vitals,
      presetEnv: nominal.envTelemetry,
      liveVitals: livePersonVitals,
      liveEnv: liveIssEnv,
      countermeasureVitalsPatch: lbnp.vitalsPatch,
      countermeasureEnvPatch: cdra.envPatch,
    });

    expect(recovered.vitals.heartRateBpm).toBe(75);
    expect(recovered.envTelemetry.cabinCo2MmHg).toBe(2.4);
    expect(recovered.vitals.ocularFinding).toBe("clear");

    const recoveredEval = evaluateCrewHealth(
      recovered.vitals,
      recovered.envTelemetry,
      "iss_orbit"
    );
    expect(recoveredEval.systems.neuro_ocular.status).toBe("green");
  });
});

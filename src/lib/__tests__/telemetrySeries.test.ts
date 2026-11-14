import { describe, expect, it } from "vitest";
import { BASE_14_SOL_HISTORY, DEMO_SCENARIOS } from "@/data/nasaHrpData";
import { build14SolSeries } from "@/components/TelemetryCharts";

describe("TelemetryCharts build14SolSeries", () => {
  it("appends Sol 14 (Now) with live vitals and habitat telemetry without mutating base history", () => {
    const baseHistory = BASE_14_SOL_HISTORY.iss_orbit;
    const originalLength = baseHistory.length;
    const scenario = DEMO_SCENARIOS.find((s) => s.id === "sans_co2_fluid_shift");
    if (!scenario) throw new Error("Missing sans_co2_fluid_shift scenario");

    const series = build14SolSeries(
      baseHistory,
      scenario.vitals,
      scenario.envTelemetry
    );

    expect(baseHistory).toHaveLength(originalLength);
    expect(series).toHaveLength(originalLength + 1);

    const latest = series[series.length - 1];
    expect(latest.sol).toBe("Sol 14 (Now)");
    expect(latest.heartRateBpm).toBe(scenario.vitals.heartRateBpm);
    expect(latest.systolicBp).toBe(scenario.vitals.bloodPressureSystolic);
    expect(latest.bloodGlucoseMgDl).toBe(scenario.vitals.bloodGlucoseMgDl);
    expect(latest.issCabinCo2MmHg).toBe(scenario.envTelemetry.cabinCo2MmHg);
    expect(latest.gcrDoseMsv).toBe(scenario.envTelemetry.gcrDoseMsv);
    expect(latest.saaDoseMsv).toBe(scenario.envTelemetry.saaOrSpeDoseMsv);
    expect(latest.totalRadiationMsv).toBe(
      scenario.envTelemetry.dailyRadiationMsv
    );
  });

  it("handles empty history arrays cleanly by returning a single Sol 14 (Now) point", () => {
    const nominal = DEMO_SCENARIOS[0];
    const series = build14SolSeries([], nominal.vitals, nominal.envTelemetry);

    expect(series).toHaveLength(1);
    expect(series[0].sol).toBe("Sol 14 (Now)");
    expect(series[0].groundControlCo2MmHg).toBe(0.35);
  });
});

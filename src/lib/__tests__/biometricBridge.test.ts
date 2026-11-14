import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS } from "@/data/nasaHrpData";
import {
  computeRppgHeartRateFromGreenSeries,
  generateAstroskinTelemetryFrame,
  parseBleHeartRateMeasurement,
} from "@/lib/biometricBridge";

describe("biometricBridge", () => {
  it("parses 8-bit BLE GATT 0x2A37 heart rate measurement with RR intervals", () => {
    // Flags: 0x16 -> 8-bit HR (0), contact supported & detected (0x06), RR present (0x10)
    const buffer = new ArrayBuffer(6);
    const view = new DataView(buffer);
    view.setUint8(0, 0x16);
    view.setUint8(1, 74); // 74 bpm
    view.setUint16(2, 832, true); // 832 / 1024 * 1000 = 812.5 ms
    view.setUint16(4, 820, true); // 820 / 1024 * 1000 = 800.8 ms

    const reading = parseBleHeartRateMeasurement(view);
    expect(reading.heartRateBpm).toBe(74);
    expect(reading.contactDetected).toBe(true);
    expect(reading.rrIntervalsMs).toHaveLength(2);
    expect(reading.rrIntervalsMs[0]).toBeCloseTo(812.5, 1);
    expect(reading.estimatedSystolicBp).toBeGreaterThanOrEqual(90);
    expect(reading.estimatedDiastolicBp).toBeGreaterThanOrEqual(55);
  });

  it("parses 16-bit BLE GATT 0x2A37 heart rate measurement with Energy Expended skipped", () => {
    // Flags: 0x09 -> 16-bit HR (0x01) + Energy Expended present (0x08)
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    view.setUint8(0, 0x09);
    view.setUint16(1, 132, true);
    view.setUint16(3, 500, true); // energy expended kJ

    const reading = parseBleHeartRateMeasurement(view);
    expect(reading.heartRateBpm).toBe(132);
    expect(reading.rrIntervalsMs).toHaveLength(0);
  });

  it("extracts accurate BPM from synthetic webcam rPPG green-channel waves at 60 bpm and 90 bpm", () => {
    const sampleRateHz = 20;
    const sampleCount = 120; // 6 seconds

    // 1.0 Hz = 60 bpm
    const wave60 = Array.from({ length: sampleCount }, (_, i) => {
      const t = i / sampleRateHz;
      return 128 + 3.5 * Math.sin(2 * Math.PI * 1.0 * t);
    });
    const res60 = computeRppgHeartRateFromGreenSeries(wave60, sampleRateHz);
    expect(Math.abs(res60.heartRateBpm - 60)).toBeLessThanOrEqual(2);
    expect(res60.confidencePct).toBeGreaterThan(50);

    // 1.5 Hz = 90 bpm
    const wave90 = Array.from({ length: sampleCount }, (_, i) => {
      const t = i / sampleRateHz;
      return 135 + 4.0 * Math.sin(2 * Math.PI * 1.5 * t);
    });
    const res90 = computeRppgHeartRateFromGreenSeries(wave90, sampleRateHz);
    expect(Math.abs(res90.heartRateBpm - 90)).toBeLessThanOrEqual(2);
    expect(res90.confidencePct).toBeGreaterThan(50);
  });

  it("generates clamped 1 Hz CSA Astroskin frames with respiratory sinus arrhythmia modulation", () => {
    const base = DEMO_SCENARIOS[0].vitals;
    const frame1 = generateAstroskinTelemetryFrame(base, 1);
    const frame2 = generateAstroskinTelemetryFrame(base, 4);

    expect(frame1.heartRateBpm).toBeGreaterThanOrEqual(30);
    expect(frame1.heartRateBpm).toBeLessThanOrEqual(200);
    expect(frame2.bloodPressureSystolic).toBeGreaterThanOrEqual(60);
    expect(frame2.bodyTempC).toBeGreaterThanOrEqual(34);
  });
});

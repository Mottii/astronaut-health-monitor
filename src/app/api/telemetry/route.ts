import { NextResponse } from "next/server";
import {
  DEMO_SCENARIOS,
  MISSION_ENVIRONMENTS,
  NASA_FLIGHT_HARDWARE_SPECS,
} from "@/data/nasaHrpData";
import { clampVitalReadings } from "@/lib/triageEngine";
import type { EnvironmentTelemetry, VitalReadings } from "@/types/health";

interface HardwareIngestBuffer {
  timestampUtc: string;
  source: string;
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
}

let telemetryBuffer: HardwareIngestBuffer = {
  timestampUtc: new Date().toISOString(),
  source: "csa_astroskin_chp_ida_bus",
  vitals: { ...DEMO_SCENARIOS[0].vitals },
  envTelemetry: { ...MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry },
};

/**
 * GET /api/telemetry
 * Returns the latest NASA CHP-IDA hardware-compatible telemetry packet.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    protocol: "NASA-CHP-IDA-1.0",
    timestampUtc: telemetryBuffer.timestampUtc,
    source: telemetryBuffer.source,
    vitals: telemetryBuffer.vitals,
    envTelemetry: telemetryBuffer.envTelemetry,
    hardwareSpecsCount: NASA_FLIGHT_HARDWARE_SPECS.length,
  });
}

/**
 * POST /api/telemetry
 * Ingests live physiological or spacecraft hardware telemetry packets (ESP32/Arduino,
 * CSA Astroskin bridge, Apple Health shortcut, or automated hardware test harnesses).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      vitals?: Partial<VitalReadings>;
      envTelemetry?: Partial<EnvironmentTelemetry>;
      source?: string;
    };

    const nextVitals = clampVitalReadings({
      ...telemetryBuffer.vitals,
      ...(body.vitals ?? {}),
    });

    const nextEnv: EnvironmentTelemetry = {
      ...telemetryBuffer.envTelemetry,
      ...(body.envTelemetry ?? {}),
    };

    telemetryBuffer = {
      timestampUtc: new Date().toISOString(),
      source:
        typeof body.source === "string" && body.source.trim().length > 0
          ? body.source.trim().slice(0, 64)
          : "external_hardware_ingest",
      vitals: nextVitals,
      envTelemetry: nextEnv,
    };

    return NextResponse.json({
      status: "ok",
      protocol: "NASA-CHP-IDA-1.0",
      timestampUtc: telemetryBuffer.timestampUtc,
      source: telemetryBuffer.source,
      vitals: telemetryBuffer.vitals,
      envTelemetry: telemetryBuffer.envTelemetry,
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON telemetry payload" },
      { status: 400 }
    );
  }
}

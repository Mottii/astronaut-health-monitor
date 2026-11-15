import { NextResponse } from "next/server";
import {
  DEFAULT_CREW_PROFILES,
  DEMO_SCENARIOS,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
} from "@/data/nasaHrpData";
import { ARES_TWIN_PROTOCOL } from "@/lib/clinicalThresholds";
import { normalizeCrewProfile } from "@/lib/crewProfileStorage";
import {
  applyCountermeasureToState,
  clampVitalReadings,
  evaluateCrewHealth,
} from "@/lib/triageEngine";
import {
  computeOrganSensitivityMultipliers,
  runPreFlightQualificationSuite,
  simulatePersonalizedDrugResponse,
} from "@/lib/twinEngine";
import type {
  AstronautBiologicalProfile,
  CountermeasureActionSpec,
  EnvironmentTelemetry,
  MissionEnvironmentId,
  VitalReadings,
} from "@/types/health";

const MAX_BODY_BYTES = 65_536; // 64 KB limit

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(
  data: unknown,
  init?: { status?: number }
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: CORS_HEADERS,
  });
}

function findActionById(
  actionId: string
): CountermeasureActionSpec | undefined {
  for (const list of Object.values(EXECUTABLE_COUNTERMEASURES)) {
    const match = list.find((a) => a.id === actionId);
    if (match) return match;
  }
  return undefined;
}

/**
 * OPTIONS /api/twin-simulate
 * Enables browser-based cross-origin API testing without credential forwarding.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/twin-simulate
 * Exposes the ARES-TWIN/1.0 open simulation schema and synthetic crew profiles.
 */
export async function GET() {
  return jsonResponse({
    status: "ok",
    protocol: ARES_TWIN_PROTOCOL,
    disclaimer:
      "Synthetic demonstration profiles — educational simulation, not medical advice.",
    capabilities: {
      localMechanisticEngine: true,
      localOllamaBridge: true,
      openRestSimulationApi: true,
      serverUrlForwarding: false,
    },
    defaultCrewProfiles: DEFAULT_CREW_PROFILES.map((profile) => ({
      id: profile.id,
      callsign: profile.callsign,
      name: profile.name,
      role: profile.role,
      summaryTag: profile.summaryTag,
      multipliers: computeOrganSensitivityMultipliers(profile),
    })),
    requestSchema: {
      profileId: "string (optional: ares_1_vance | ares_2_chen | ares_3_korolev)",
      profile: "AstronautBiologicalProfile (optional custom blood + SOMA omics JSON)",
      envId: "iss_orbit | lunar_rover | mars_transit | mars_base",
      vitals: "Partial<VitalReadings>",
      envTelemetry: "Partial<EnvironmentTelemetry>",
      activeDrugIds: "string[] (optional active pharmacologic exposures)",
      actionId: "string (optional countermeasure / drug ID, e.g. neuro_acetazolamide_rx)",
    },
  });
}

/**
 * POST /api/twin-simulate
 * Runs an open-API per-astronaut BioTwin physiological & rule-based Rx simulation.
 * Never performs server-side URL forwarding (SSRF-safe); external BYO endpoints
 * are invoked directly from the client.
 */
export async function POST(request: Request) {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BODY_BYTES) {
      return jsonResponse(
        {
          status: "error",
          message: "Request body exceeds 64 KB limit.",
        },
        { status: 413 }
      );
    }
  }

  let rawText = "";
  try {
    rawText = await request.text();
  } catch {
    return jsonResponse(
      { status: "error", message: "Unable to read request body." },
      { status: 400 }
    );
  }

  if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(
      {
        status: "error",
        message: "Request body exceeds 64 KB limit.",
      },
      { status: 413 }
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    return jsonResponse(
      {
        status: "error",
        message: "Invalid JSON payload for /api/twin-simulate.",
      },
      { status: 400 }
    );
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    Array.isArray(parsedBody)
  ) {
    return jsonResponse(
      {
        status: "error",
        message: "Request body must be a JSON object.",
      },
      { status: 400 }
    );
  }

  const body = parsedBody as {
    messages?: unknown;
    profile?: unknown;
    profileId?: unknown;
    envId?: unknown;
    vitals?: Partial<VitalReadings>;
    envTelemetry?: Partial<EnvironmentTelemetry>;
    activeDrugIds?: unknown;
    actionId?: unknown;
  };

  if (Array.isArray(body.messages)) {
    return jsonResponse(
      {
        status: "error",
        message:
          "OpenAI chat completion payloads (messages[]) are not supported by /api/twin-simulate. Send an ARES-TWIN simulation payload ({ profileId | profile, envId, vitals, actionId }).",
      },
      { status: 400 }
    );
  }

  let profile: AstronautBiologicalProfile;
  if (body.profile !== undefined) {
    const normalized = normalizeCrewProfile(body.profile);
    if (
      !normalized ||
      (normalized.provenance?.suppliedFields.length ?? 0) === 0
    ) {
      return jsonResponse(
        {
          status: "error",
          message:
            "Invalid biological profile object: must contain at least one valid biochemical, pharmacogenomic, or endurance field.",
        },
        { status: 400 }
      );
    }
    profile = normalized;
  } else if (body.profileId !== undefined) {
    if (typeof body.profileId !== "string") {
      return jsonResponse(
        { status: "error", message: "profileId must be a string." },
        { status: 400 }
      );
    }
    const matched = DEFAULT_CREW_PROFILES.find((p) => p.id === body.profileId);
    if (!matched) {
      return jsonResponse(
        {
          status: "error",
          message: `Unknown profileId: ${body.profileId}`,
        },
        { status: 404 }
      );
    }
    profile = matched;
  } else {
    profile = DEFAULT_CREW_PROFILES[0];
  }

  let envId: MissionEnvironmentId = profile.missionAssignment;
  if (body.envId !== undefined) {
    if (
      typeof body.envId !== "string" ||
      !(body.envId in MISSION_ENVIRONMENTS)
    ) {
      return jsonResponse(
        {
          status: "error",
          message: `Unknown envId: ${String(body.envId)}`,
        },
        { status: 400 }
      );
    }
    envId = body.envId as MissionEnvironmentId;
  }

  let selectedAction: CountermeasureActionSpec | undefined;
  if (body.actionId !== undefined) {
    if (typeof body.actionId !== "string") {
      return jsonResponse(
        { status: "error", message: "actionId must be a string." },
        { status: 422 }
      );
    }
    selectedAction = findActionById(body.actionId);
    if (!selectedAction) {
      return jsonResponse(
        {
          status: "error",
          message: `Unknown actionId: ${body.actionId}`,
        },
        { status: 422 }
      );
    }
  }

  const activeDrugIds = Array.isArray(body.activeDrugIds)
    ? body.activeDrugIds.filter((id): id is string => typeof id === "string")
    : [];

  try {
    const vitals = clampVitalReadings({
      ...DEMO_SCENARIOS[0].vitals,
      ...(typeof body.vitals === "object" && body.vitals !== null
        ? body.vitals
        : {}),
    });

    const envTelemetry: EnvironmentTelemetry = {
      ...MISSION_ENVIRONMENTS[envId].defaultTelemetry,
      ...(typeof body.envTelemetry === "object" && body.envTelemetry !== null
        ? body.envTelemetry
        : {}),
    };

    const multipliers = computeOrganSensitivityMultipliers(profile);
    const evaluation = evaluateCrewHealth(
      vitals,
      envTelemetry,
      envId,
      profile,
      { activeDrugIds }
    );
    const qualificationTests = runPreFlightQualificationSuite(profile);

    let drugSimulation = null;
    let postActionEvaluation = null;
    if (selectedAction) {
      drugSimulation = simulatePersonalizedDrugResponse(
        profile,
        selectedAction,
        vitals,
        envTelemetry
      );
      const post = applyCountermeasureToState(
        vitals,
        envTelemetry,
        selectedAction,
        profile
      );
      const postDrugIds = Array.from(
        new Set([...activeDrugIds, selectedAction.id])
      );
      postActionEvaluation = evaluateCrewHealth(
        post.vitals,
        post.envTelemetry,
        envId,
        profile,
        { activeDrugIds: postDrugIds }
      );
    }

    const flaggedQual = qualificationTests.find(
      (q) => q.status === "contraindicated" || q.status === "caution"
    );
    const summary = [
      `[OPEN API :: ${ARES_TWIN_PROTOCOL}] Profile=${profile.name} (${profile.callsign}) · Env=${MISSION_ENVIRONMENTS[envId].name}`,
      `Readiness=${evaluation.readinessScore}/100 (${evaluation.overallStatus.toUpperCase()}) | Neuro=${multipliers.neuro_ocular}x · Renal=${multipliers.musculoskeletal_renal}x · Immune=${multipliers.immune_hematology}x`,
      flaggedQual
        ? `Key Qualification Alert (${flaggedQual.title} -> ${flaggedQual.status.toUpperCase()}): ${flaggedQual.clinicalSummary}`
        : "All 4 JSC Pre-Flight Qualification Assays passed within nominal endurance envelope.",
    ].join("\n\n");

    return jsonResponse({
      status: "ok",
      protocol: ARES_TWIN_PROTOCOL,
      disclaimer:
        "Synthetic demonstration profiles — educational simulation, not medical advice.",
      timestampUtc: new Date().toISOString(),
      profile: {
        id: profile.id,
        callsign: profile.callsign,
        name: profile.name,
        summaryTag: profile.summaryTag,
        provenance: profile.provenance,
      },
      multipliers,
      evaluation,
      qualificationTests,
      drugSimulation,
      postActionEvaluation,
      summary,
    });
  } catch {
    return jsonResponse(
      {
        status: "error",
        message: "Internal simulation error.",
      },
      { status: 500 }
    );
  }
}

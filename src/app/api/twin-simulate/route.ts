import { NextResponse } from "next/server";
import {
  DEFAULT_CREW_PROFILES,
  DEMO_SCENARIOS,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
} from "@/data/nasaHrpData";
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
  CountermeasureActionSpec,
  EnvironmentTelemetry,
  MissionEnvironmentId,
  VitalReadings,
} from "@/types/health";

function findActionById(actionId: string): CountermeasureActionSpec | undefined {
  for (const list of Object.values(EXECUTABLE_COUNTERMEASURES)) {
    const match = list.find((a) => a.id === actionId);
    if (match) return match;
  }
  return undefined;
}

/**
 * GET /api/twin-simulate
 * Exposes the NASA-SOMA-TWIN-1.0 open simulation schema and pre-flight crew profiles.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    protocol: "NASA-SOMA-TWIN-1.0",
    capabilities: {
      localMechanisticEngine: true,
      localOllamaBridge: true,
      openRestSimulationApi: true,
      byoOpenAiCompatibleUrl: true,
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
      actionId: "string (optional countermeasure / drug ID, e.g. neuro_acetazolamide_rx)",
      externalOpenAiUrl: "string (optional BYO OpenAI-compatible chat/completions URL)",
    },
  });
}

/**
 * POST /api/twin-simulate
 * Runs an open-API per-astronaut BioTwin physiological & pharmacogenomic simulation
 * (or forwards to a caller-supplied OpenAI-compatible model endpoint).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      profile?: unknown;
      profileId?: string;
      envId?: MissionEnvironmentId;
      vitals?: Partial<VitalReadings>;
      envTelemetry?: Partial<EnvironmentTelemetry>;
      actionId?: string;
      externalOpenAiUrl?: string;
      externalApiKey?: string;
    };

    const matchedDefault = body.profileId
      ? DEFAULT_CREW_PROFILES.find((p) => p.id === body.profileId)
      : undefined;
    const profile =
      normalizeCrewProfile(body.profile) ??
      matchedDefault ??
      DEFAULT_CREW_PROFILES[0];

    const envId: MissionEnvironmentId =
      body.envId && body.envId in MISSION_ENVIRONMENTS
        ? body.envId
        : profile.missionAssignment;

    const vitals = clampVitalReadings({
      ...DEMO_SCENARIOS[0].vitals,
      ...(body.vitals ?? {}),
    });

    const envTelemetry: EnvironmentTelemetry = {
      ...MISSION_ENVIRONMENTS[envId].defaultTelemetry,
      ...(body.envTelemetry ?? {}),
    };

    const multipliers = computeOrganSensitivityMultipliers(profile);
    const evaluation = evaluateCrewHealth(vitals, envTelemetry, envId, profile);
    const qualificationTests = runPreFlightQualificationSuite(profile);

    let drugSimulation = null;
    let postActionEvaluation = null;
    if (body.actionId) {
      const action = findActionById(body.actionId);
      if (action) {
        drugSimulation = simulatePersonalizedDrugResponse(
          profile,
          action,
          vitals,
          envTelemetry
        );
        const post = applyCountermeasureToState(
          vitals,
          envTelemetry,
          action,
          profile
        );
        postActionEvaluation = evaluateCrewHealth(
          post.vitals,
          post.envTelemetry,
          envId,
          profile
        );
      }
    }

    let externalModelSummary: string | null = null;
    if (
      typeof body.externalOpenAiUrl === "string" &&
      (body.externalOpenAiUrl.startsWith("https://") ||
        body.externalOpenAiUrl.startsWith("http://"))
    ) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const extRes = await fetch(body.externalOpenAiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(body.externalApiKey
              ? { Authorization: `Bearer ${body.externalApiKey}` }
              : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are an aerospace Precision Medicine Flight Surgeon reviewing a pre-flight calibrated BioTwin simulation.",
              },
              {
                role: "user",
                content: `Astronaut ${profile.name} (${profile.callsign}) multipliers: ${JSON.stringify(multipliers)}. Readiness: ${evaluation.readinessScore}/100. Qualification: ${qualificationTests.map((q) => `${q.title}=${q.status}`).join(", ")}. Provide a concise 3-line clinical readiness verdict.`,
              },
            ],
            temperature: 0.2,
            max_tokens: 180,
          }),
        });
        clearTimeout(timer);
        if (extRes.ok) {
          const extJson = (await extRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          externalModelSummary =
            extJson?.choices?.[0]?.message?.content?.trim() ?? null;
        }
      } catch {
        externalModelSummary = null;
      }
    }

    const flaggedQual = qualificationTests.find(
      (q) => q.status === "contraindicated" || q.status === "caution"
    );
    const summary =
      externalModelSummary ??
      [
        `[OPEN API :: NASA-SOMA-TWIN-1.0] Profile=${profile.name} (${profile.callsign}) · Env=${MISSION_ENVIRONMENTS[envId].name}`,
        `Readiness=${evaluation.readinessScore}/100 (${evaluation.overallStatus.toUpperCase()}) | Neuro=${multipliers.neuro_ocular}x · Renal=${multipliers.musculoskeletal_renal}x · Immune=${multipliers.immune_hematology}x`,
        flaggedQual
          ? `Key Qualification Alert (${flaggedQual.title} -> ${flaggedQual.status.toUpperCase()}): ${flaggedQual.clinicalSummary}`
          : "All 4 JSC Pre-Flight Qualification Assays passed within nominal aerospace endurance envelope.",
      ].join("\n\n");

    return NextResponse.json({
      status: "ok",
      protocol: "NASA-SOMA-TWIN-1.0",
      timestampUtc: new Date().toISOString(),
      profile: {
        id: profile.id,
        callsign: profile.callsign,
        name: profile.name,
        summaryTag: profile.summaryTag,
      },
      multipliers,
      evaluation,
      qualificationTests,
      drugSimulation,
      postActionEvaluation,
      summary,
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid JSON payload for /api/twin-simulate",
      },
      { status: 400 }
    );
  }
}

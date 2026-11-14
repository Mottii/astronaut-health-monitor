import { DEFAULT_CREW_PROFILES } from "@/data/nasaHrpData";
import {
  ALL_BIOLOGICAL_FIELDS,
  REFERENCE_BASELINE,
} from "@/lib/clinicalThresholds";
import type {
  AstronautBiologicalProfile,
  CypMetabolizerPhenotype,
  MissionEnvironmentId,
  MtrrGenotype,
  ProfileProvenance,
  TwinInferenceConfig,
} from "@/types/health";

export const CREW_PROFILE_STORAGE_KEY = "ares_med_crew_profiles_v1";
export const OPEN_API_KEY_SESSION_KEY = "ares_med_open_api_key_v1";

export const DEFAULT_INFERENCE_CONFIG: TwinInferenceConfig = {
  mode: "local_mechanistic",
  localEndpointUrl: "http://localhost:11434/v1/chat/completions",
  localModelName: "llama3.2",
  openApiEndpointUrl: "/api/twin-simulate",
  openApiKey: "",
};

export interface CrewProfilesStorageState {
  activeProfileId: string;
  profiles: AstronautBiologicalProfile[];
  inferenceConfig: TwinInferenceConfig;
  updatedAt: number;
}

export type DossierUploadParseResult =
  | { ok: true; profile: AstronautBiologicalProfile }
  | { ok: false; error: string };

export function createDefaultCrewProfilesState(): CrewProfilesStorageState {
  return {
    activeProfileId: DEFAULT_CREW_PROFILES[0].id,
    profiles: DEFAULT_CREW_PROFILES.map((p) => ({
      ...p,
      biochemical: { ...p.biochemical },
      pharmacogenomics: { ...p.pharmacogenomics },
      endurance: { ...p.endurance },
      provenance: p.provenance
        ? {
            ...p.provenance,
            suppliedFields: [...p.provenance.suppliedFields],
            defaultedFields: [...p.provenance.defaultedFields],
          }
        : undefined,
    })),
    inferenceConfig: { ...DEFAULT_INFERENCE_CONFIG },
    updatedAt: 0,
  };
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function parseMission(raw: unknown): MissionEnvironmentId {
  return raw === "iss_orbit" ||
    raw === "lunar_rover" ||
    raw === "mars_transit" ||
    raw === "mars_base"
    ? raw
    : "mars_transit";
}

function parseMtrr(raw: unknown): MtrrGenotype | null {
  if (
    raw === "AA_normal" ||
    raw === "AG_heterozygous" ||
    raw === "GG_sans_risk"
  ) {
    return raw;
  }
  return null;
}

function parseCyp(raw: unknown): CypMetabolizerPhenotype | null {
  if (
    raw === "ultra_rapid" ||
    raw === "normal" ||
    raw === "intermediate" ||
    raw === "poor"
  ) {
    return raw;
  }
  return null;
}

function parseSavedProvenance(raw: unknown): ProfileProvenance | undefined {
  if (!isRecord(raw)) return undefined;
  const st = raw.sourceType;
  if (
    st !== "builtin" &&
    st !== "json_upload" &&
    st !== "text_upload" &&
    st !== "manual_override"
  ) {
    return undefined;
  }
  const supplied = Array.isArray(raw.suppliedFields)
    ? raw.suppliedFields.filter((x): x is string => typeof x === "string")
    : [];
  const defaulted = Array.isArray(raw.defaultedFields)
    ? raw.defaultedFields.filter((x): x is string => typeof x === "string")
    : [];
  return {
    sourceType: st,
    fileName: typeof raw.fileName === "string" ? raw.fileName : undefined,
    suppliedFields: supplied,
    defaultedFields: defaulted,
  };
}

/**
 * Validates and normalizes an uploaded JSON astronaut biological profile against
 * NASA SSM / SOMA field bounds. Any omitted or invalid field falls back to the
 * neutral population-reference baseline (never a high-risk astronaut persona)
 * and is recorded in `profile.provenance.defaultedFields`.
 */
export function normalizeCrewProfile(
  raw: unknown,
  fallbackId?: string,
  provenanceMeta?: {
    sourceType: ProfileProvenance["sourceType"];
    fileName?: string;
  }
): AstronautBiologicalProfile | null {
  if (!isRecord(raw)) return null;

  const bioRaw = isRecord(raw.biochemical) ? raw.biochemical : {};
  const pgxRaw = isRecord(raw.pharmacogenomics) ? raw.pharmacogenomics : {};
  const endRaw = isRecord(raw.endurance) ? raw.endurance : {};

  const suppliedFields: string[] = [];
  const defaultedFields: string[] = [];

  const numField = (
    key: string,
    v: unknown,
    def: number,
    min: number,
    max: number
  ): number => {
    if (typeof v === "number" && Number.isFinite(v)) {
      suppliedFields.push(key);
      return Math.min(max, Math.max(min, v));
    }
    defaultedFields.push(key);
    return def;
  };

  const mtrrParsed = parseMtrr(pgxRaw.mtrrGenotype);
  if (mtrrParsed) suppliedFields.push("mtrrGenotype");
  else defaultedFields.push("mtrrGenotype");

  const cyp2d6Parsed = parseCyp(pgxRaw.cyp2d6Phenotype);
  if (cyp2d6Parsed) suppliedFields.push("cyp2d6Phenotype");
  else defaultedFields.push("cyp2d6Phenotype");

  const cyp2c9Parsed = parseCyp(pgxRaw.cyp2c9Phenotype);
  if (cyp2c9Parsed) suppliedFields.push("cyp2c9Phenotype");
  else defaultedFields.push("cyp2c9Phenotype");

  const biochemical = {
    urinaryCalciumMgDay: numField(
      "urinaryCalciumMgDay",
      bioRaw.urinaryCalciumMgDay,
      REFERENCE_BASELINE.biochemical.urinaryCalciumMgDay,
      40,
      600
    ),
    urinaryCitrateMgDay: numField(
      "urinaryCitrateMgDay",
      bioRaw.urinaryCitrateMgDay,
      REFERENCE_BASELINE.biochemical.urinaryCitrateMgDay,
      60,
      900
    ),
    serumCtxPgMl: numField(
      "serumCtxPgMl",
      bioRaw.serumCtxPgMl,
      REFERENCE_BASELINE.biochemical.serumCtxPgMl,
      80,
      1400
    ),
    baselineLymphocyteCount: numField(
      "baselineLymphocyteCount",
      bioRaw.baselineLymphocyteCount,
      REFERENCE_BASELINE.biochemical.baselineLymphocyteCount,
      400,
      5000
    ),
    serumFerritinNgMl: numField(
      "serumFerritinNgMl",
      bioRaw.serumFerritinNgMl,
      REFERENCE_BASELINE.biochemical.serumFerritinNgMl,
      10,
      600
    ),
    baselineNflPgMl: numField(
      "baselineNflPgMl",
      bioRaw.baselineNflPgMl,
      REFERENCE_BASELINE.biochemical.baselineNflPgMl,
      2,
      60
    ),
  };

  const pharmacogenomics = {
    mtrrGenotype:
      mtrrParsed ?? REFERENCE_BASELINE.pharmacogenomics.mtrrGenotype,
    cyp2d6Phenotype:
      cyp2d6Parsed ?? REFERENCE_BASELINE.pharmacogenomics.cyp2d6Phenotype,
    cyp2c9Phenotype:
      cyp2c9Parsed ?? REFERENCE_BASELINE.pharmacogenomics.cyp2c9Phenotype,
    atmDnaRepairScore: numField(
      "atmDnaRepairScore",
      pgxRaw.atmDnaRepairScore,
      REFERENCE_BASELINE.pharmacogenomics.atmDnaRepairScore,
      0.4,
      1.5
    ),
  };

  const endurance = {
    co2ReactivitySlope: numField(
      "co2ReactivitySlope",
      endRaw.co2ReactivitySlope,
      REFERENCE_BASELINE.endurance.co2ReactivitySlope,
      0.5,
      2.2
    ),
    baselineOnsdMm: numField(
      "baselineOnsdMm",
      endRaw.baselineOnsdMm,
      REFERENCE_BASELINE.endurance.baselineOnsdMm,
      3.5,
      6.2
    ),
    dexaBoneTScore: numField(
      "dexaBoneTScore",
      endRaw.dexaBoneTScore,
      REFERENCE_BASELINE.endurance.dexaBoneTScore,
      -3.0,
      2.5
    ),
    lbnpEnduranceMin: numField(
      "lbnpEnduranceMin",
      endRaw.lbnpEnduranceMin,
      REFERENCE_BASELINE.endurance.lbnpEnduranceMin,
      10,
      60
    ),
    radiationToleranceMsvDay: numField(
      "radiationToleranceMsvDay",
      endRaw.radiationToleranceMsvDay,
      REFERENCE_BASELINE.endurance.radiationToleranceMsvDay,
      0.8,
      4.0
    ),
  };

  const rawCallsign =
    typeof raw.callsign === "string" && raw.callsign.trim()
      ? raw.callsign.trim().slice(0, 16)
      : "ARES-LAB";
  const rawName =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 64)
      : "Imported Crew Profile";

  const derivedSlug = (rawCallsign !== "ARES-LAB" ? rawCallsign : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : fallbackId ?? `custom_${derivedSlug || "profile"}`;

  const savedProv = provenanceMeta ? undefined : parseSavedProvenance(raw.provenance);
  const provenance: ProfileProvenance = savedProv ?? {
    sourceType: provenanceMeta?.sourceType ?? "json_upload",
    fileName: provenanceMeta?.fileName,
    suppliedFields,
    defaultedFields,
  };

  return {
    id,
    callsign: rawCallsign,
    name: rawName,
    role:
      typeof raw.role === "string" && raw.role.trim()
        ? raw.role.trim().slice(0, 64)
        : "Mission Specialist",
    missionAssignment: parseMission(raw.missionAssignment),
    summaryTag:
      typeof raw.summaryTag === "string" && raw.summaryTag.trim()
        ? raw.summaryTag.trim().slice(0, 80)
        : `SMO 016E / SOMA (${provenance.suppliedFields.length}/${ALL_BIOLOGICAL_FIELDS.length} fields extracted)`,
    biochemical,
    pharmacogenomics,
    endurance,
    provenance,
  };
}

function extractOptionalNumber(
  text: string,
  pattern: RegExp,
  min: number,
  max: number
): number | undefined {
  const m = text.match(pattern);
  if (!m || !m[1]) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function extractOptionalCyp(
  text: string,
  gene: "CYP2D6" | "CYP2C9"
): CypMetabolizerPhenotype | undefined {
  const re = new RegExp(
    `${gene}(?:Phenotype)?[^\\n.;]{0,36}[:=\\s,]+(ultra[-_ ]?rapid|poor|intermediate|normal)`,
    "i"
  );
  const m = text.match(re);
  if (!m || !m[1]) return undefined;
  const raw = m[1].toLowerCase().replace(/[- ]+/g, "_");
  return parseCyp(raw) ?? undefined;
}

function extractOptionalMtrr(text: string): MtrrGenotype | undefined {
  const m = text.match(
    /MTRR(?:Genotype)?[^\n.;]{0,24}(GG_sans_risk|AG_heterozygous|AA_normal|66GG|66AG|66AA|\bGG\b|\bAG\b|\bAA\b)/i
  );
  if (!m || !m[1]) return undefined;
  const tok = m[1].toUpperCase();
  if (tok.includes("GG")) return "GG_sans_risk";
  if (tok.includes("AG")) return "AG_heterozygous";
  if (tok.includes("AA")) return "AA_normal";
  return undefined;
}

/**
 * Normalizes simple 2-row header+values CSV into "key: value" lines so the
 * single deterministic regex extractor handles both TXT reports and CSV tables.
 */
function expandTabularCsvIfApplicable(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 2 && lines[0].includes(",") && lines[1].includes(",")) {
    const headers = lines[0].split(",").map((s) => s.trim());
    const values = lines[1].split(",").map((s) => s.trim());
    if (headers.length >= 2 && headers.length === values.length) {
      return headers.map((h, i) => `${h}: ${values[i]}`).join("\n");
    }
  }
  return text;
}

function slugifyFileName(fileName: string): {
  cleanStem: string;
  slug: string;
} {
  const cleanStem = fileName
    .replace(/\.(pdf|json|txt|csv)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const slug = cleanStem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
  return { cleanStem, slug };
}

/**
 * Parses an uploaded biological dossier (.json, .txt, or .csv) without
 * fabricating missing values. Binary PDFs and files containing zero recognized
 * biological fields are rejected with an explicit diagnostic message.
 */
export function parseUploadedDossierReport(
  fileName: string,
  textContent: string
): DossierUploadParseResult {
  const trimmed = textContent.trim();
  if (!trimmed) {
    return { ok: false, error: `Uploaded file "${fileName}" is empty.` };
  }

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf") || trimmed.startsWith("%PDF")) {
    return {
      ok: false,
      error:
        "PDF text extraction is not supported offline. Please export the lab dossier as JSON, TXT, or CSV.",
    };
  }

  const { cleanStem, slug } = slugifyFileName(fileName);
  const deterministicId = `dossier_${slug || "upload"}`;

  // 1. Structured JSON dossier path
  if (
    lowerName.endsWith(".json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        error: `Invalid JSON syntax in "${fileName}".`,
      };
    }

    const normalized = normalizeCrewProfile(parsed, deterministicId, {
      sourceType: "json_upload",
      fileName,
    });
    if (!normalized || (normalized.provenance?.suppliedFields.length ?? 0) === 0) {
      return {
        ok: false,
        error: `JSON file "${fileName}" contains no recognized biochemical, pharmacogenomic, or endurance fields.`,
      };
    }
    return { ok: true, profile: normalized };
  }

  // 2. Plain-text / CSV key-value dossier path (no fabricated defaults)
  const normalizedText = expandTabularCsvIfApplicable(trimmed);

  const nameMatch = normalizedText.match(
    /^(?:name|astronaut)[:\s=,]+([^\r\n,]{2,60})/im
  );
  const callsignMatch = normalizedText.match(
    /^(?:callsign)[:\s=,]+([A-Za-z0-9_-]{2,16})/im
  );

  const biochemical: Record<string, number | undefined> = {
    urinaryCalciumMgDay: extractOptionalNumber(
      normalizedText,
      /(?:urinary\s*ca(?:lcium)?|ca2\+|urinaryCalciumMgDay|urinary_calcium)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      40,
      600
    ),
    urinaryCitrateMgDay: extractOptionalNumber(
      normalizedText,
      /(?:urinary\s*citrate|citrate|urinaryCitrateMgDay|urinary_citrate)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      60,
      900
    ),
    serumCtxPgMl: extractOptionalNumber(
      normalizedText,
      /(?:serum\s*ctx|ctx|serumCtxPgMl|serum_ctx)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      80,
      1400
    ),
    baselineLymphocyteCount: extractOptionalNumber(
      normalizedText,
      /(?:baseline\s*alc|alc|lymphocytes?|baselineLymphocyteCount)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      400,
      5000
    ),
    serumFerritinNgMl: extractOptionalNumber(
      normalizedText,
      /(?:serum\s*ferritin|ferritin|serumFerritinNgMl)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      10,
      600
    ),
    baselineNflPgMl: extractOptionalNumber(
      normalizedText,
      /(?:baseline\s*nfl|nfl|neurofilament|baselineNflPgMl)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      2,
      60
    ),
  };

  const pharmacogenomics: Record<string, string | number | undefined> = {
    mtrrGenotype: extractOptionalMtrr(normalizedText),
    cyp2d6Phenotype: extractOptionalCyp(normalizedText, "CYP2D6"),
    cyp2c9Phenotype: extractOptionalCyp(normalizedText, "CYP2C9"),
    atmDnaRepairScore: extractOptionalNumber(
      normalizedText,
      /(?:atm(?:\s*dna\s*repair)?|atmDnaRepairScore)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      0.4,
      1.5
    ),
  };

  const endurance: Record<string, number | undefined> = {
    co2ReactivitySlope: extractOptionalNumber(
      normalizedText,
      /(?:co2[^:\n=,]{0,18}slope|co2ReactivitySlope)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      0.5,
      2.2
    ),
    baselineOnsdMm: extractOptionalNumber(
      normalizedText,
      /(?:baseline\s*onsd|onsd|baselineOnsdMm)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      3.5,
      6.2
    ),
    dexaBoneTScore: extractOptionalNumber(
      normalizedText,
      /(?:dexa(?:\s*t-?score)?|t-?score|dexaBoneTScore)[:\s=,]+(-?[0-9]+(?:\.[0-9]+)?)/i,
      -3.0,
      2.5
    ),
    lbnpEnduranceMin: extractOptionalNumber(
      normalizedText,
      /(?:lbnp(?:\s*endurance)?|lbnpEnduranceMin)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      10,
      60
    ),
    radiationToleranceMsvDay: extractOptionalNumber(
      normalizedText,
      /(?:radiation\s*tolerance|rad(?:iation)?_?tolerance|radiationToleranceMsvDay)[:\s=,]+([0-9]+(?:\.[0-9]+)?)/i,
      0.8,
      4.0
    ),
  };

  const profile = normalizeCrewProfile(
    {
      id: deterministicId,
      callsign: callsignMatch?.[1]?.trim() || "ARES-LAB",
      name:
        nameMatch?.[1]?.trim() ||
        (cleanStem ? cleanStem.slice(0, 48) : "Imported Crew Dossier"),
      role: "Lab Dossier Import",
      missionAssignment: "mars_transit",
      biochemical,
      pharmacogenomics,
      endurance,
    },
    deterministicId,
    { sourceType: "text_upload", fileName }
  );

  if (!profile || (profile.provenance?.suppliedFields.length ?? 0) === 0) {
    return {
      ok: false,
      error: `No recognized biochemical, pharmacogenomic, or endurance fields found in "${fileName}".`,
    };
  }

  return { ok: true, profile };
}

/**
 * Convenience wrapper returning the parsed profile or null on rejection.
 */
export function parseUploadedDossierFile(
  fileName: string,
  textContent: string
): AstronautBiologicalProfile | null {
  const result = parseUploadedDossierReport(fileName, textContent);
  return result.ok ? result.profile : null;
}

export function loadCrewProfilesState(
  storage?: Pick<Storage, "getItem">,
  sessionStorageOverride?: Pick<Storage, "getItem">
): CrewProfilesStorageState {
  let targetStorage: Pick<Storage, "getItem"> | undefined = storage;
  let targetSession: Pick<Storage, "getItem"> | undefined = sessionStorageOverride;

  if (typeof window !== "undefined") {
    if (!targetStorage) {
      try {
        targetStorage = window.localStorage;
      } catch {
        targetStorage = undefined;
      }
    }
    if (!targetSession) {
      try {
        targetSession = window.sessionStorage;
      } catch {
        targetSession = undefined;
      }
    }
  }

  let sessionOpenApiKey = "";
  if (targetSession) {
    try {
      sessionOpenApiKey = targetSession.getItem(OPEN_API_KEY_SESSION_KEY) ?? "";
    } catch {
      sessionOpenApiKey = "";
    }
  }

  if (!targetStorage) {
    const def = createDefaultCrewProfilesState();
    def.inferenceConfig.openApiKey = sessionOpenApiKey;
    return def;
  }

  try {
    const raw = targetStorage.getItem(CREW_PROFILE_STORAGE_KEY);
    if (!raw) {
      const def = createDefaultCrewProfilesState();
      def.inferenceConfig.openApiKey = sessionOpenApiKey;
      return def;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      const def = createDefaultCrewProfilesState();
      def.inferenceConfig.openApiKey = sessionOpenApiKey;
      return def;
    }

    const profilesRaw = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const normalizedProfiles = profilesRaw
      .map((p) => normalizeCrewProfile(p))
      .filter((p): p is AstronautBiologicalProfile => p !== null);

    const profiles =
      normalizedProfiles.length > 0
        ? normalizedProfiles
        : createDefaultCrewProfilesState().profiles;

    const activeProfileId =
      typeof parsed.activeProfileId === "string" &&
      profiles.some((p) => p.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : profiles[0].id;

    const cfgRaw = isRecord(parsed.inferenceConfig)
      ? parsed.inferenceConfig
      : {};
    const modeRaw = cfgRaw.mode;
    const mode =
      modeRaw === "local_mechanistic" ||
      modeRaw === "local_ollama_llm" ||
      modeRaw === "open_api"
        ? modeRaw
        : DEFAULT_INFERENCE_CONFIG.mode;

    const updatedAt =
      typeof parsed.updatedAt === "number" &&
      Number.isFinite(parsed.updatedAt) &&
      parsed.updatedAt >= 0
        ? parsed.updatedAt
        : 0;

    return {
      activeProfileId,
      profiles,
      inferenceConfig: {
        mode,
        localEndpointUrl:
          typeof cfgRaw.localEndpointUrl === "string" &&
          cfgRaw.localEndpointUrl.trim()
            ? cfgRaw.localEndpointUrl.trim()
            : DEFAULT_INFERENCE_CONFIG.localEndpointUrl,
        localModelName:
          typeof cfgRaw.localModelName === "string" &&
          cfgRaw.localModelName.trim()
            ? cfgRaw.localModelName.trim()
            : DEFAULT_INFERENCE_CONFIG.localModelName,
        openApiEndpointUrl:
          typeof cfgRaw.openApiEndpointUrl === "string" &&
          cfgRaw.openApiEndpointUrl.trim()
            ? cfgRaw.openApiEndpointUrl.trim()
            : DEFAULT_INFERENCE_CONFIG.openApiEndpointUrl,
        // Never hydrate openApiKey from localStorage; keep it strictly in sessionStorage
        openApiKey: sessionOpenApiKey,
      },
      updatedAt,
    };
  } catch {
    const def = createDefaultCrewProfilesState();
    def.inferenceConfig.openApiKey = sessionOpenApiKey;
    return def;
  }
}

export function saveCrewProfilesState(
  state: CrewProfilesStorageState,
  storage?: Pick<Storage, "setItem">,
  sessionStorageOverride?: Pick<Storage, "setItem" | "removeItem">
): void {
  let targetStorage: Pick<Storage, "setItem"> | undefined = storage;
  let targetSession: Pick<Storage, "setItem" | "removeItem"> | undefined =
    sessionStorageOverride;

  if (typeof window !== "undefined") {
    if (!targetStorage) {
      try {
        targetStorage = window.localStorage;
      } catch {
        targetStorage = undefined;
      }
    }
    if (!targetSession) {
      try {
        targetSession = window.sessionStorage;
      } catch {
        targetSession = undefined;
      }
    }
  }

  if (targetSession) {
    try {
      const trimmedKey = state.inferenceConfig.openApiKey.trim();
      if (trimmedKey) {
        targetSession.setItem(OPEN_API_KEY_SESSION_KEY, trimmedKey);
      } else {
        targetSession.removeItem(OPEN_API_KEY_SESSION_KEY);
      }
    } catch {
      // Ignore sessionStorage errors cleanly
    }
  }

  if (!targetStorage) return;

  try {
    const { openApiKey: _omitKey, ...persistedInferenceConfig } =
      state.inferenceConfig;
    void _omitKey;
    const payload = {
      activeProfileId: state.activeProfileId,
      profiles: state.profiles,
      inferenceConfig: persistedInferenceConfig,
      updatedAt: state.updatedAt,
    };
    targetStorage.setItem(CREW_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / privacy mode errors cleanly
  }
}

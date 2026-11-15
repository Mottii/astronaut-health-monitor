import { DEFAULT_CREW_PROFILES } from "@/data/nasaHrpData";
import {
  ALL_BIOLOGICAL_FIELDS,
  REFERENCE_BASELINE,
} from "@/lib/clinicalThresholds";
import type {
  AstronautBiologicalProfile,
  ConvertedFieldRecord,
  CypMetabolizerPhenotype,
  MissionEnvironmentId,
  MtrrGenotype,
  ProfileProvenance,
  RejectedFieldRecord,
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
  openApiModelName: "gpt-4o-mini",
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

const BIOLOGICAL_FIELD_SET = new Set<string>(ALL_BIOLOGICAL_FIELDS);

const BASELINE_FIELD_VALUES: Record<string, number | string> = {
  ...REFERENCE_BASELINE.biochemical,
  ...REFERENCE_BASELINE.pharmacogenomics,
  ...REFERENCE_BASELINE.endurance,
};

const BIO_KEY_ALIASES: Record<string, string[]> = {
  urinaryCalciumMgDay: [
    "urinaryCalciumMgDay",
    "urinary_calcium_mg_day",
    "urinary_calcium",
    "urinaryCalcium",
  ],
  urinaryCitrateMgDay: [
    "urinaryCitrateMgDay",
    "urinary_citrate_mg_day",
    "urinary_citrate",
    "urinaryCitrate",
  ],
  serumCtxPgMl: [
    "serumCtxPgMl",
    "serum_ctx_pg_ml",
    "serum_ctx",
    "serumCtx",
    "ctx",
  ],
  baselineLymphocyteCount: [
    "baselineLymphocyteCount",
    "baseline_lymphocyte_count",
    "baseline_alc",
    "alc",
    "lymphocytes",
  ],
  serumFerritinNgMl: [
    "serumFerritinNgMl",
    "serum_ferritin_ng_ml",
    "serum_ferritin",
    "ferritin",
  ],
  baselineNflPgMl: [
    "baselineNflPgMl",
    "baseline_nfl_pg_ml",
    "baseline_nfl",
    "nfl",
  ],
};

const PGX_KEY_ALIASES: Record<string, string[]> = {
  mtrrGenotype: ["mtrrGenotype", "mtrr_genotype", "mtrr"],
  cyp2d6Phenotype: ["cyp2d6Phenotype", "cyp2d6_phenotype", "cyp2d6"],
  cyp2c9Phenotype: ["cyp2c9Phenotype", "cyp2c9_phenotype", "cyp2c9"],
  atmDnaRepairScore: [
    "atmDnaRepairScore",
    "atm_dna_repair_score",
    "atm_dna_repair",
    "atm",
  ],
};

const END_KEY_ALIASES: Record<string, string[]> = {
  co2ReactivitySlope: [
    "co2ReactivitySlope",
    "co2_reactivity_slope",
    "co2_slope",
    "co2Slope",
  ],
  baselineOnsdMm: ["baselineOnsdMm", "baseline_onsd_mm", "baseline_onsd", "onsd"],
  dexaBoneTScore: [
    "dexaBoneTScore",
    "dexa_bone_t_score",
    "dexa_t_score",
    "dexa",
  ],
  lbnpEnduranceMin: [
    "lbnpEnduranceMin",
    "lbnp_endurance_min",
    "lbnp_endurance",
    "lbnp",
  ],
  radiationToleranceMsvDay: [
    "radiationToleranceMsvDay",
    "radiation_tolerance_msv_day",
    "radiation_tolerance",
    "rad_tolerance",
  ],
};

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
            convertedFields: p.provenance.convertedFields
              ? [...p.provenance.convertedFields]
              : undefined,
            rejectedFields: p.provenance.rejectedFields
              ? [...p.provenance.rejectedFields]
              : undefined,
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
  if (
    raw === "iss_orbit" ||
    raw === "lunar_rover" ||
    raw === "mars_transit" ||
    raw === "mars_base"
  ) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const lower = raw.trim().toLowerCase();
    if (
      lower.includes("iss") ||
      lower.includes("leo") ||
      lower.includes("orbit")
    ) {
      return "iss_orbit";
    }
    if (
      lower.includes("lunar") ||
      lower.includes("moon") ||
      lower.includes("rover")
    ) {
      return "lunar_rover";
    }
    if (
      lower.includes("mars_base") ||
      lower.includes("mars base") ||
      lower.includes("surface") ||
      lower.includes("habitat")
    ) {
      return "mars_base";
    }
    if (lower.includes("mars")) {
      return "mars_transit";
    }
  }
  return "mars_transit";
}

function parseMtrr(raw: unknown): MtrrGenotype | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (
    trimmed === "AA_normal" ||
    trimmed === "AG_heterozygous" ||
    trimmed === "GG_sans_risk"
  ) {
    return trimmed;
  }
  const upper = trimmed.toUpperCase().replace(/[\s_-]+/g, "");
  if (upper === "AA" || upper === "66AA" || upper === "AANORMAL") {
    return "AA_normal";
  }
  if (upper === "AG" || upper === "66AG" || upper === "AGHETEROZYGOUS") {
    return "AG_heterozygous";
  }
  if (upper === "GG" || upper === "66GG" || upper === "GGSANSRISK") {
    return "GG_sans_risk";
  }
  return null;
}

function parseCyp(raw: unknown): CypMetabolizerPhenotype | null {
  if (typeof raw !== "string") return null;
  const norm = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (norm === "ultra_rapid" || norm === "ultrarapid") {
    return "ultra_rapid";
  }
  if (norm === "normal" || norm === "extensive") {
    return "normal";
  }
  if (norm === "intermediate") {
    return "intermediate";
  }
  if (norm === "poor") {
    return "poor";
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

  const convertedFields: ConvertedFieldRecord[] | undefined = Array.isArray(
    raw.convertedFields
  )
    ? raw.convertedFields
        .filter(isRecord)
        .filter(
          (c) =>
            typeof c.field === "string" &&
            typeof c.rawValue === "number" &&
            typeof c.rawUnit === "string" &&
            typeof c.convertedValue === "number" &&
            typeof c.targetUnit === "string"
        )
        .map((c) => ({
          field: c.field as string,
          rawValue: c.rawValue as number,
          rawUnit: c.rawUnit as string,
          convertedValue: c.convertedValue as number,
          targetUnit: c.targetUnit as string,
        }))
    : undefined;

  const rejectedFields: RejectedFieldRecord[] | undefined = Array.isArray(
    raw.rejectedFields
  )
    ? raw.rejectedFields
        .filter(isRecord)
        .filter(
          (r) =>
            typeof r.field === "string" &&
            (typeof r.rawValue === "string" || typeof r.rawValue === "number") &&
            typeof r.reason === "string"
        )
        .map((r) => ({
          field: r.field as string,
          rawValue: r.rawValue as string | number,
          reason: r.reason as string,
        }))
    : undefined;

  return {
    sourceType: st,
    fileName: typeof raw.fileName === "string" ? raw.fileName : undefined,
    suppliedFields: supplied,
    defaultedFields: defaulted,
    ...(convertedFields && convertedFields.length > 0
      ? { convertedFields }
      : {}),
    ...(rejectedFields && rejectedFields.length > 0 ? { rejectedFields } : {}),
  };
}

function isValidProvenancePartition(
  prov: ProfileProvenance,
  validatedSuppliedSet: Set<string>,
  rejectedKeySet: Set<string>,
  normalizedValues: Record<string, number | string>
): boolean {
  if (
    prov.suppliedFields.length + prov.defaultedFields.length !==
    ALL_BIOLOGICAL_FIELDS.length
  ) {
    return false;
  }
  const seen = new Set<string>();
  for (const f of prov.suppliedFields) {
    if (!BIOLOGICAL_FIELD_SET.has(f) || seen.has(f)) return false;
    if (!validatedSuppliedSet.has(f) || rejectedKeySet.has(f)) return false;
    seen.add(f);
  }
  for (const f of prov.defaultedFields) {
    if (!BIOLOGICAL_FIELD_SET.has(f) || seen.has(f)) return false;
    if (normalizedValues[f] !== BASELINE_FIELD_VALUES[f]) return false;
    seen.add(f);
  }
  return seen.size === ALL_BIOLOGICAL_FIELDS.length;
}

function lookupWithAliases(
  sectionObj: Record<string, unknown>,
  rootObj: Record<string, unknown>,
  canonicalKey: string,
  aliasesMap: Record<string, string[]>
): unknown {
  const keys = aliasesMap[canonicalKey] ?? [canonicalKey];
  for (const k of keys) {
    if (sectionObj[k] !== undefined) return sectionObj[k];
  }
  for (const k of keys) {
    if (rootObj[k] !== undefined) return rootObj[k];
  }
  return undefined;
}

/**
 * Validates and normalizes an uploaded JSON astronaut biological profile against
 * NASA SSM / SOMA field bounds. Any omitted or out-of-bounds field falls back to the
 * neutral population-reference baseline (never a high-risk astronaut persona)
 * and is recorded in `profile.provenance.defaultedFields` (and `rejectedFields` if invalid).
 */
export function normalizeCrewProfile(
  raw: unknown,
  fallbackId?: string,
  provenanceMeta?: {
    sourceType: ProfileProvenance["sourceType"];
    fileName?: string;
    convertedFields?: ConvertedFieldRecord[];
    rejectedFields?: RejectedFieldRecord[];
  }
): AstronautBiologicalProfile | null {
  if (!isRecord(raw)) return null;

  const bioRaw = isRecord(raw.biochemical) ? raw.biochemical : {};
  const pgxRaw = isRecord(raw.pharmacogenomics) ? raw.pharmacogenomics : {};
  const endRaw = isRecord(raw.endurance) ? raw.endurance : {};

  const getBio = (k: string) => lookupWithAliases(bioRaw, raw, k, BIO_KEY_ALIASES);
  const getPgx = (k: string) => lookupWithAliases(pgxRaw, raw, k, PGX_KEY_ALIASES);
  const getEnd = (k: string) => lookupWithAliases(endRaw, raw, k, END_KEY_ALIASES);

  const suppliedFields: string[] = [];
  const defaultedFields: string[] = [];
  const rejectedFields: RejectedFieldRecord[] = [
    ...(provenanceMeta?.rejectedFields ?? []),
  ];
  const preRejectedKeys = new Set(rejectedFields.map((r) => r.field));

  const numField = (
    key: string,
    v: unknown,
    def: number,
    min: number,
    max: number
  ): number => {
    if (preRejectedKeys.has(key)) {
      defaultedFields.push(key);
      return def;
    }
    if (v === undefined || v === null || v === "") {
      defaultedFields.push(key);
      return def;
    }
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : Number.NaN;
    if (!Number.isFinite(n)) {
      rejectedFields.push({
        field: key,
        rawValue: String(v),
        reason: `Non-numeric value "${String(v)}"`,
      });
      defaultedFields.push(key);
      return def;
    }
    if (n < min || n > max) {
      rejectedFields.push({
        field: key,
        rawValue: n,
        reason: `Value ${n} is outside clinical bounds [${min}, ${max}]`,
      });
      defaultedFields.push(key);
      return def;
    }
    suppliedFields.push(key);
    return n;
  };

  const mtrrRaw = getPgx("mtrrGenotype");
  const mtrrParsed = preRejectedKeys.has("mtrrGenotype")
    ? null
    : parseMtrr(mtrrRaw);
  if (mtrrParsed) {
    suppliedFields.push("mtrrGenotype");
  } else {
    if (
      !preRejectedKeys.has("mtrrGenotype") &&
      mtrrRaw !== undefined &&
      mtrrRaw !== null &&
      mtrrRaw !== ""
    ) {
      rejectedFields.push({
        field: "mtrrGenotype",
        rawValue: String(mtrrRaw),
        reason: `Unrecognized MTRR genotype "${String(mtrrRaw)}"`,
      });
    }
    defaultedFields.push("mtrrGenotype");
  }

  const cyp2d6Raw = getPgx("cyp2d6Phenotype");
  const cyp2d6Parsed = preRejectedKeys.has("cyp2d6Phenotype")
    ? null
    : parseCyp(cyp2d6Raw);
  if (cyp2d6Parsed) {
    suppliedFields.push("cyp2d6Phenotype");
  } else {
    if (
      !preRejectedKeys.has("cyp2d6Phenotype") &&
      cyp2d6Raw !== undefined &&
      cyp2d6Raw !== null &&
      cyp2d6Raw !== ""
    ) {
      rejectedFields.push({
        field: "cyp2d6Phenotype",
        rawValue: String(cyp2d6Raw),
        reason: `Unrecognized CYP2D6 phenotype "${String(cyp2d6Raw)}"`,
      });
    }
    defaultedFields.push("cyp2d6Phenotype");
  }

  const cyp2c9Raw = getPgx("cyp2c9Phenotype");
  const cyp2c9Parsed = preRejectedKeys.has("cyp2c9Phenotype")
    ? null
    : parseCyp(cyp2c9Raw);
  if (cyp2c9Parsed) {
    suppliedFields.push("cyp2c9Phenotype");
  } else {
    if (
      !preRejectedKeys.has("cyp2c9Phenotype") &&
      cyp2c9Raw !== undefined &&
      cyp2c9Raw !== null &&
      cyp2c9Raw !== ""
    ) {
      rejectedFields.push({
        field: "cyp2c9Phenotype",
        rawValue: String(cyp2c9Raw),
        reason: `Unrecognized CYP2C9 phenotype "${String(cyp2c9Raw)}"`,
      });
    }
    defaultedFields.push("cyp2c9Phenotype");
  }

  const biochemical = {
    urinaryCalciumMgDay: numField(
      "urinaryCalciumMgDay",
      getBio("urinaryCalciumMgDay"),
      REFERENCE_BASELINE.biochemical.urinaryCalciumMgDay,
      40,
      600
    ),
    urinaryCitrateMgDay: numField(
      "urinaryCitrateMgDay",
      getBio("urinaryCitrateMgDay"),
      REFERENCE_BASELINE.biochemical.urinaryCitrateMgDay,
      60,
      900
    ),
    serumCtxPgMl: numField(
      "serumCtxPgMl",
      getBio("serumCtxPgMl"),
      REFERENCE_BASELINE.biochemical.serumCtxPgMl,
      80,
      1400
    ),
    baselineLymphocyteCount: numField(
      "baselineLymphocyteCount",
      getBio("baselineLymphocyteCount"),
      REFERENCE_BASELINE.biochemical.baselineLymphocyteCount,
      400,
      5000
    ),
    serumFerritinNgMl: numField(
      "serumFerritinNgMl",
      getBio("serumFerritinNgMl"),
      REFERENCE_BASELINE.biochemical.serumFerritinNgMl,
      10,
      600
    ),
    baselineNflPgMl: numField(
      "baselineNflPgMl",
      getBio("baselineNflPgMl"),
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
      getPgx("atmDnaRepairScore"),
      REFERENCE_BASELINE.pharmacogenomics.atmDnaRepairScore,
      0.4,
      1.5
    ),
  };

  const endurance = {
    co2ReactivitySlope: numField(
      "co2ReactivitySlope",
      getEnd("co2ReactivitySlope"),
      REFERENCE_BASELINE.endurance.co2ReactivitySlope,
      0.5,
      2.2
    ),
    baselineOnsdMm: numField(
      "baselineOnsdMm",
      getEnd("baselineOnsdMm"),
      REFERENCE_BASELINE.endurance.baselineOnsdMm,
      3.5,
      6.2
    ),
    dexaBoneTScore: numField(
      "dexaBoneTScore",
      getEnd("dexaBoneTScore"),
      REFERENCE_BASELINE.endurance.dexaBoneTScore,
      -3.0,
      2.5
    ),
    lbnpEnduranceMin: numField(
      "lbnpEnduranceMin",
      getEnd("lbnpEnduranceMin"),
      REFERENCE_BASELINE.endurance.lbnpEnduranceMin,
      10,
      60
    ),
    radiationToleranceMsvDay: numField(
      "radiationToleranceMsvDay",
      getEnd("radiationToleranceMsvDay"),
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

  const validatedSuppliedSet = new Set(suppliedFields);
  const rejectedKeySet = new Set(rejectedFields.map((r) => r.field));
  const normalizedValues: Record<string, number | string> = {
    ...biochemical,
    ...pharmacogenomics,
    ...endurance,
  };
  const candidateSavedProv = parseSavedProvenance(raw.provenance);
  const validSavedProv =
    candidateSavedProv &&
    isValidProvenancePartition(
      candidateSavedProv,
      validatedSuppliedSet,
      rejectedKeySet,
      normalizedValues
    )
      ? candidateSavedProv
      : undefined;

  const mergedConverted = [
    ...(validSavedProv?.convertedFields ?? []),
    ...(provenanceMeta?.convertedFields ?? []),
  ];
  const mergedRejected = [
    ...(validSavedProv?.rejectedFields ?? []),
    ...rejectedFields,
  ];

  const provenance: ProfileProvenance = validSavedProv
    ? {
        sourceType: validSavedProv.sourceType,
        fileName: provenanceMeta?.fileName ?? validSavedProv.fileName,
        suppliedFields: validSavedProv.suppliedFields,
        defaultedFields: validSavedProv.defaultedFields,
        ...(mergedConverted.length > 0
          ? { convertedFields: mergedConverted }
          : {}),
        ...(mergedRejected.length > 0
          ? { rejectedFields: mergedRejected }
          : {}),
      }
    : {
        sourceType: provenanceMeta?.sourceType ?? "json_upload",
        fileName: provenanceMeta?.fileName,
        suppliedFields,
        defaultedFields,
        ...(mergedConverted.length > 0
          ? { convertedFields: mergedConverted }
          : {}),
        ...(mergedRejected.length > 0
          ? { rejectedFields: mergedRejected }
          : {}),
      };

  const missionRaw =
    raw.missionAssignment ??
    raw.mission_assignment ??
    raw.mission ??
    raw.environment;

  return {
    id,
    callsign: rawCallsign,
    name: rawName,
    role:
      typeof raw.role === "string" && raw.role.trim()
        ? raw.role.trim().slice(0, 64)
        : "Mission Specialist",
    missionAssignment: parseMission(missionRaw),
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

interface ExtractedNumberResult {
  value: number | undefined;
  converted?: ConvertedFieldRecord;
  rejected?: RejectedFieldRecord;
}

function extractNumberWithUnit(
  text: string,
  field: string,
  labelPattern: string,
  targetUnit: string,
  unitConverter?: (
    rawVal: number,
    unit: string
  ) =>
    | { kind: "converted"; value: number }
    | { kind: "same" }
    | { kind: "rejected"; reason: string }
): ExtractedNumberResult {
  const re = new RegExp(
    `(?<![A-Za-z0-9_])(?:${labelPattern})(?![A-Za-z0-9_])[ \\t:=,]+(-?[0-9]+(?:\\.[0-9]+)?)(?:[ \\t]*((?:(?:x|×)[ \\t]*10\\^?(?:3|³|9|⁹)\\/[A-Za-zµμ]+)|[×xA-Za-z0-9^/*µμ⁹³+-]+(?:\\/[A-Za-z0-9^µμ]+)?))?`,
    "i"
  );
  const m = text.match(re);
  if (!m || !m[1]) return { value: undefined };
  const rawVal = Number(m[1]);
  if (!Number.isFinite(rawVal)) return { value: undefined };

  const rawUnitCandidate = m[2]?.trim() ?? "";
  const compactUnit = rawUnitCandidate.replace(/\s+/g, "");
  const looksLikeUnit =
    compactUnit.length > 0 &&
    /^(?:(?:x|×)?10\^?(?:3|³|9|⁹)\/[a-zµμ]+|k\/[a-zµμ]+|g\/l|mmol\/(?:d|day|24h|24hr|24hrs|l)|mg\/(?:d|day|24h|24hr|24hrs|dl|l)|pg\/ml|ng\/ml|(?:u|µ|μ|mc)g\/l|\/(?:u|µ|μ)l|cells\/(?:u|µ|μ)l|mm|min|msv(?:\/d|\/day)?|sd|x)$/i.test(
      compactUnit
    );
  const unit = looksLikeUnit ? compactUnit : "";

  if (unit && unitConverter) {
    const res = unitConverter(rawVal, unit);
    if (res.kind === "converted") {
      return {
        value: res.value,
        converted: {
          field,
          rawValue: rawVal,
          rawUnit: rawUnitCandidate,
          convertedValue: res.value,
          targetUnit,
        },
      };
    }
    if (res.kind === "rejected") {
      return {
        value: undefined,
        rejected: {
          field,
          rawValue: `${rawVal} ${rawUnitCandidate}`,
          reason: res.reason,
        },
      };
    }
  }

  return { value: rawVal };
}

function extractOptionalCyp(
  text: string,
  gene: "CYP2D6" | "CYP2C9",
  fieldKey: "cyp2d6Phenotype" | "cyp2c9Phenotype",
  rejectedOut: RejectedFieldRecord[]
): CypMetabolizerPhenotype | undefined {
  const validRe = new RegExp(
    `\\b${gene}(?:Phenotype|_phenotype)?[^\\n.;]{0,36}[:=\\s,]+(ultra[-_ ]?rapid|ultrarapid|poor|intermediate|normal|extensive)\\b`,
    "i"
  );
  const m = text.match(validRe);
  if (m && m[1]) {
    return parseCyp(m[1]) ?? undefined;
  }
  const lineRe = new RegExp(
    `^\\s*${gene}(?:Phenotype|_phenotype)?\\s*[:=,]\\s*([^\\r\\n,;]+)`,
    "im"
  );
  const badMatch = text.match(lineRe);
  if (badMatch && badMatch[1]?.trim()) {
    const token = badMatch[1].trim();
    const parsed = parseCyp(token);
    if (parsed) return parsed;
    rejectedOut.push({
      field: fieldKey,
      rawValue: token,
      reason: `Unrecognized ${gene} phenotype "${token}"`,
    });
  }
  return undefined;
}

function extractOptionalMtrr(
  text: string,
  rejectedOut: RejectedFieldRecord[]
): MtrrGenotype | undefined {
  const m = text.match(
    /\bMTRR(?:Genotype|_genotype)?[^\n.;]{0,24}[:=\s,]+(GG_sans_risk|AG_heterozygous|AA_normal|66GG|66AG|66AA|\bGG\b|\bAG\b|\bAA\b)/i
  );
  if (m && m[1]) {
    return parseMtrr(m[1]) ?? undefined;
  }
  const lineMatch = text.match(
    /^\s*MTRR(?:Genotype|_genotype)?\s*[:=,]\s*([^\r\n,;]+)/im
  );
  if (lineMatch && lineMatch[1]?.trim()) {
    const token = lineMatch[1].trim();
    const parsed = parseMtrr(token);
    if (parsed) return parsed;
    rejectedOut.push({
      field: "mtrrGenotype",
      rawValue: token,
      reason: `Unrecognized MTRR genotype "${token}"`,
    });
  }
  return undefined;
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isHorizontalCsvHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  if (
    cells.length <= 3 &&
    /^(?:parameter|field|metric|test|assay|biomarker|key)$/i.test(cells[0])
  ) {
    return false;
  }
  return cells.every(
    (c) =>
      /[A-Za-z]/.test(c) &&
      !/^-?[0-9]+(?:\.[0-9]+)?(?:\s*[×xA-Za-z0-9^/*µμ⁹³+-]+(?:\/[A-Za-z0-9^µμ]+)?)?$/.test(
        c
      )
  );
}

/**
 * Normalizes 2-row header+values CSV (and 2/3-column key,value[,unit] CSV rows)
 * into "key: value" lines so the deterministic extractor handles both TXT and CSV.
 */
function expandTabularCsvIfApplicable(text: string): {
  expandedText: string;
  multiRowCount?: number;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length >= 2 && lines[0].includes(",") && lines[1].includes(",")) {
    const headers = splitCsvRow(lines[0]);
    if (isHorizontalCsvHeaderRow(headers)) {
      if (lines.length === 2) {
        const values = splitCsvRow(lines[1]);
        if (headers.length === values.length) {
          return {
            expandedText: headers.map((h, i) => `${h}: ${values[i]}`).join("\n"),
          };
        }
      } else if (
        lines
          .slice(1)
          .every((l) => l.includes(",") && splitCsvRow(l).length === headers.length)
      ) {
        return {
          expandedText: text,
          multiRowCount: lines.length - 1,
        };
      }
    }
  }
  if (lines.some((l) => l.includes(",") && !l.includes(":"))) {
    return {
      expandedText: lines
        .map((l) => {
          if (!l.includes(",") || l.includes(":")) return l;
          const cols = splitCsvRow(l);
          if (cols.length === 2) return `${cols[0]}: ${cols[1]}`;
          if (cols.length === 3) return `${cols[0]}: ${cols[1]} ${cols[2]}`.trim();
          return cols.join(", ");
        })
        .join("\n"),
    };
  }
  return { expandedText: text };
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

    if (Array.isArray(parsed)) {
      if (parsed.length === 1 && isRecord(parsed[0])) {
        parsed = parsed[0];
      } else {
        return {
          ok: false,
          error: `JSON file "${fileName}" contains a multi-element array (${parsed.length} items). Please upload a single crew dossier object or 1-element array.`,
        };
      }
    }

    const normalized = normalizeCrewProfile(parsed, deterministicId, {
      sourceType: "json_upload",
      fileName,
    });
    if (!normalized || (normalized.provenance?.suppliedFields.length ?? 0) === 0) {
      const rejected = normalized?.provenance?.rejectedFields ?? [];
      if (rejected.length > 0) {
        const details = rejected
          .map((r) => `${r.field} (${r.rawValue}: ${r.reason})`)
          .join("; ");
        return {
          ok: false,
          error: `All recognized biological fields in "${fileName}" were rejected as out-of-bounds or invalid: ${details}.`,
        };
      }
      return {
        ok: false,
        error: `JSON file "${fileName}" contains no recognized biochemical, pharmacogenomic, or endurance fields.`,
      };
    }
    return { ok: true, profile: normalized };
  }

  // 2. Plain-text / CSV key-value dossier path (no fabricated defaults)
  const csvExpansion = expandTabularCsvIfApplicable(trimmed);
  if (csvExpansion.multiRowCount && csvExpansion.multiRowCount > 1) {
    return {
      ok: false,
      error: `CSV file "${fileName}" contains ${csvExpansion.multiRowCount} crew data rows. Please upload a single crew dossier row or key-value CSV.`,
    };
  }
  const normalizedText = csvExpansion.expandedText;

  const nameMatch = normalizedText.match(
    /^(?:name|astronaut)[:\s=,]+([^\r\n]{2,60})/im
  );
  const callsignMatch = normalizedText.match(
    /^(?:callsign)[:\s=,]+([A-Za-z0-9_-]{2,16})/im
  );
  const roleMatch = normalizedText.match(
    /^(?:role|position|title)[:\s=,]+([^\r\n]{2,64})/im
  );
  const missionMatch = normalizedText.match(
    /^(?:mission(?:Assignment|_assignment|\s*profile)?|environment|envId)[:\s=,]+([^\r\n,]{2,40})/im
  );

  const convertedFields: ConvertedFieldRecord[] = [];
  const rejectedFields: RejectedFieldRecord[] = [];

  const collectNum = (res: ExtractedNumberResult): number | undefined => {
    if (res.converted) convertedFields.push(res.converted);
    if (res.rejected) rejectedFields.push(res.rejected);
    return res.value;
  };

  const biochemical: Record<string, number | undefined> = {
    urinaryCalciumMgDay: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "urinaryCalciumMgDay",
        "urinary\\s*ca(?:lcium)?|ca2\\+|urinaryCalciumMgDay|urinary_calcium",
        "mg/day",
        (val, unit) => {
          if (/^mmol\/(?:d|day|24h|24hr|24hrs)$/i.test(unit)) {
            return { kind: "converted", value: Number((val * 40).toFixed(1)) };
          }
          if (/^(?:mg\/(?:dl|l)|mmol\/l)$/i.test(unit)) {
            return {
              kind: "rejected",
              reason:
                `Spot concentration unit ${unit} requires 24h urine volume; expected mg/day or mmol/d`,
            };
          }
          return { kind: "same" };
        }
      )
    ),
    urinaryCitrateMgDay: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "urinaryCitrateMgDay",
        "urinary\\s*citrate|citrate|urinaryCitrateMgDay|urinary_citrate",
        "mg/day",
        (val, unit) => {
          if (/^mmol\/(?:d|day|24h|24hr|24hrs)$/i.test(unit)) {
            return { kind: "converted", value: Number((val * 192).toFixed(1)) };
          }
          if (/^(?:mg\/(?:dl|l)|mmol\/l)$/i.test(unit)) {
            return {
              kind: "rejected",
              reason:
                `Spot concentration unit ${unit} requires 24h urine volume; expected mg/day or mmol/d`,
            };
          }
          return { kind: "same" };
        }
      )
    ),
    serumCtxPgMl: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "serumCtxPgMl",
        "serum\\s*ctx|ctx|serumCtxPgMl|serum_ctx",
        "pg/mL",
        (val, unit) => {
          if (/^(?:ng\/ml|(?:u|µ|μ|mc)g\/l)$/i.test(unit)) {
            return { kind: "converted", value: Number((val * 1000).toFixed(1)) };
          }
          return { kind: "same" };
        }
      )
    ),
    baselineLymphocyteCount: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "baselineLymphocyteCount",
        "baseline\\s*alc|alc|lymphocytes?|baselineLymphocyteCount|baseline_lymphocyte_count",
        "/uL",
        (val, unit) => {
          if (
            /^(?:(?:x|×)?10\^?(?:3|³)\/(?:u|µ|μ)l|(?:x|×)?10\^?(?:9|⁹)\/l|k\/(?:u|µ|μ)l|g\/l)$/i.test(
              unit
            )
          ) {
            return { kind: "converted", value: Math.round(val * 1000) };
          }
          return { kind: "same" };
        }
      )
    ),
    serumFerritinNgMl: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "serumFerritinNgMl",
        "serum\\s*ferritin|ferritin|serumFerritinNgMl|serum_ferritin",
        "ng/mL"
      )
    ),
    baselineNflPgMl: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "baselineNflPgMl",
        "baseline\\s*nfl|nfl|neurofilament|baselineNflPgMl|baseline_nfl",
        "pg/mL"
      )
    ),
  };

  const pharmacogenomics: Record<string, string | number | undefined> = {
    mtrrGenotype: extractOptionalMtrr(normalizedText, rejectedFields),
    cyp2d6Phenotype: extractOptionalCyp(
      normalizedText,
      "CYP2D6",
      "cyp2d6Phenotype",
      rejectedFields
    ),
    cyp2c9Phenotype: extractOptionalCyp(
      normalizedText,
      "CYP2C9",
      "cyp2c9Phenotype",
      rejectedFields
    ),
    atmDnaRepairScore: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "atmDnaRepairScore",
        "atm(?:\\s*dna\\s*repair(?:\\s*score)?)?|atmDnaRepairScore|atm_dna_repair",
        "score"
      )
    ),
  };

  const endurance: Record<string, number | undefined> = {
    co2ReactivitySlope: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "co2ReactivitySlope",
        "co2[^:\\n=,]{0,18}slope|co2ReactivitySlope|co2_reactivity_slope",
        "x"
      )
    ),
    baselineOnsdMm: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "baselineOnsdMm",
        "baseline\\s*onsd|onsd|baselineOnsdMm|baseline_onsd",
        "mm"
      )
    ),
    dexaBoneTScore: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "dexaBoneTScore",
        "dexa(?:\\s*(?:bone\\s*)?t-?score)?|t-?score|dexaBoneTScore|dexa_t_score",
        "SD"
      )
    ),
    lbnpEnduranceMin: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "lbnpEnduranceMin",
        "lbnp(?:\\s*endurance)?|lbnpEnduranceMin|lbnp_endurance",
        "min"
      )
    ),
    radiationToleranceMsvDay: collectNum(
      extractNumberWithUnit(
        normalizedText,
        "radiationToleranceMsvDay",
        "radiation\\s*tolerance|rad(?:iation)?_?tolerance|radiationToleranceMsvDay",
        "mSv/d"
      )
    ),
  };

  const cleanedName = nameMatch?.[1]
    ? nameMatch[1].replace(/^["']+|["',]+$/g, "").trim()
    : "";

  const profile = normalizeCrewProfile(
    {
      id: deterministicId,
      callsign: callsignMatch?.[1]?.trim() || "ARES-LAB",
      name:
        cleanedName ||
        (cleanStem ? cleanStem.slice(0, 48) : "Imported Crew Dossier"),
      role: roleMatch?.[1]?.trim() || "Lab Dossier Import",
      missionAssignment: missionMatch?.[1]
        ? parseMission(missionMatch[1])
        : "mars_transit",
      biochemical,
      pharmacogenomics,
      endurance,
    },
    deterministicId,
    {
      sourceType: "text_upload",
      fileName,
      convertedFields,
      rejectedFields,
    }
  );

  if (!profile || (profile.provenance?.suppliedFields.length ?? 0) === 0) {
    const allRejected = profile?.provenance?.rejectedFields ?? rejectedFields;
    if (allRejected.length > 0) {
      const details = allRejected
        .map((r) => `${r.field} (${r.rawValue}: ${r.reason})`)
        .join("; ");
      return {
        ok: false,
        error: `All recognized biological fields in "${fileName}" were rejected as out-of-bounds or invalid units: ${details}.`,
      };
    }
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
  let targetSession: Pick<Storage, "getItem"> | undefined =
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
        openApiModelName:
          typeof cfgRaw.openApiModelName === "string" &&
          cfgRaw.openApiModelName.trim()
            ? cfgRaw.openApiModelName.trim()
            : DEFAULT_INFERENCE_CONFIG.openApiModelName,
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

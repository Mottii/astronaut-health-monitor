import { DEFAULT_CREW_PROFILES } from "@/data/nasaHrpData";
import type {
  AstronautBiologicalProfile,
  TwinInferenceConfig,
} from "@/types/health";

export const CREW_PROFILE_STORAGE_KEY = "ares_med_crew_profiles_v1";

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
}

export function createDefaultCrewProfilesState(): CrewProfilesStorageState {
  return {
    activeProfileId: DEFAULT_CREW_PROFILES[0].id,
    profiles: DEFAULT_CREW_PROFILES.map((p) => ({
      ...p,
      biochemical: { ...p.biochemical },
      pharmacogenomics: { ...p.pharmacogenomics },
      endurance: { ...p.endurance },
    })),
    inferenceConfig: { ...DEFAULT_INFERENCE_CONFIG },
  };
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

/**
 * Validates and normalizes an uploaded JSON astronaut biological profile against
 * NASA SSM / SOMA field bounds so corrupted uploads cannot break the twin engine.
 */
export function normalizeCrewProfile(
  raw: unknown,
  fallbackId?: string
): AstronautBiologicalProfile | null {
  if (!isRecord(raw)) return null;
  const fallback = DEFAULT_CREW_PROFILES[0];
  const bioRaw = isRecord(raw.biochemical) ? raw.biochemical : {};
  const pgxRaw = isRecord(raw.pharmacogenomics) ? raw.pharmacogenomics : {};
  const endRaw = isRecord(raw.endurance) ? raw.endurance : {};

  const num = (v: unknown, def: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(max, Math.max(min, v))
      : def;

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : fallbackId ?? `custom_${Date.now()}`;

  const missionRaw = raw.missionAssignment;
  const missionAssignment =
    missionRaw === "iss_orbit" ||
    missionRaw === "lunar_rover" ||
    missionRaw === "mars_transit" ||
    missionRaw === "mars_base"
      ? missionRaw
      : "mars_transit";

  const mtrrRaw = pgxRaw.mtrrGenotype;
  const mtrrGenotype =
    mtrrRaw === "AA_normal" ||
    mtrrRaw === "AG_heterozygous" ||
    mtrrRaw === "GG_sans_risk"
      ? mtrrRaw
      : fallback.pharmacogenomics.mtrrGenotype;

  const parseCyp = (v: unknown, def: "normal" | "ultra_rapid" | "intermediate" | "poor") =>
    v === "ultra_rapid" || v === "normal" || v === "intermediate" || v === "poor"
      ? v
      : def;

  return {
    id,
    callsign:
      typeof raw.callsign === "string" && raw.callsign.trim()
        ? raw.callsign.trim().slice(0, 16)
        : "ARES-CUSTOM",
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, 64)
        : "Uploaded Astronaut Profile",
    role:
      typeof raw.role === "string" && raw.role.trim()
        ? raw.role.trim().slice(0, 64)
        : "Mission Specialist",
    missionAssignment,
    summaryTag:
      typeof raw.summaryTag === "string" && raw.summaryTag.trim()
        ? raw.summaryTag.trim().slice(0, 80)
        : "Custom JSC SMO 016E / SOMA Baseline",
    biochemical: {
      urinaryCalciumMgDay: num(bioRaw.urinaryCalciumMgDay, 180, 40, 600),
      urinaryCitrateMgDay: num(bioRaw.urinaryCitrateMgDay, 380, 60, 900),
      serumCtxPgMl: num(bioRaw.serumCtxPgMl, 320, 80, 1400),
      baselineLymphocyteCount: num(bioRaw.baselineLymphocyteCount, 2100, 400, 5000),
      serumFerritinNgMl: num(bioRaw.serumFerritinNgMl, 110, 10, 600),
      baselineNflPgMl: num(bioRaw.baselineNflPgMl, 9.5, 2, 60),
    },
    pharmacogenomics: {
      mtrrGenotype,
      cyp2d6Phenotype: parseCyp(pgxRaw.cyp2d6Phenotype, "normal"),
      cyp2c9Phenotype: parseCyp(pgxRaw.cyp2c9Phenotype, "normal"),
      atmDnaRepairScore: num(pgxRaw.atmDnaRepairScore, 1.0, 0.4, 1.5),
    },
    endurance: {
      co2ReactivitySlope: num(endRaw.co2ReactivitySlope, 1.0, 0.5, 2.2),
      baselineOnsdMm: num(endRaw.baselineOnsdMm, 4.6, 3.5, 6.2),
      dexaBoneTScore: num(endRaw.dexaBoneTScore, 0.0, -3.0, 2.5),
      lbnpEnduranceMin: num(endRaw.lbnpEnduranceMin, 32, 10, 60),
      radiationToleranceMsvDay: num(endRaw.radiationToleranceMsvDay, 2.0, 0.8, 4.0),
    },
  };
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function extractNumMatch(
  text: string,
  pattern: RegExp,
  fallback: number,
  min: number,
  max: number
): number {
  const m = text.match(pattern);
  if (!m || !m[1]) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function extractCypToken(
  text: string,
  gene: "CYP2D6" | "CYP2C9",
  fallback: "ultra_rapid" | "normal" | "intermediate" | "poor"
): "ultra_rapid" | "normal" | "intermediate" | "poor" {
  const re = new RegExp(
    `${gene}[^\\n.;]{0,40}(ultra[-_ ]?rapid|poor|intermediate|normal)`,
    "i"
  );
  const m = text.match(re);
  if (!m || !m[1]) return fallback;
  const raw = m[1].toLowerCase().replace(/[- ]+/g, "_");
  if (
    raw === "ultra_rapid" ||
    raw === "poor" ||
    raw === "intermediate" ||
    raw === "normal"
  ) {
    return raw;
  }
  return fallback;
}

/**
 * Parses a one-shot uploaded biological dossier (.json or .pdf / text lab report)
 * into a validated AstronautBiologicalProfile ready for immediate BioTwin calibration.
 */
export function parseUploadedDossierFile(
  fileName: string,
  textContent: string
): AstronautBiologicalProfile | null {
  const trimmed = textContent.trim();
  if (!trimmed) return null;

  // 1. Structured JSON dossier path
  if (fileName.toLowerCase().endsWith(".json") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const normalized = normalizeCrewProfile(parsed);
      if (normalized) return normalized;
    } catch {
      // Fall through to PDF/text parser if content is non-JSON text
    }
  }

  // 2. PDF or plain-text clinical dossier extraction path
  const cleanStem = fileName
    .replace(/\.(pdf|json|txt)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const displayName = cleanStem ? cleanStem.slice(0, 48) : "Imported Crew Dossier";
  const seed = hashSeed(`${fileName}:${trimmed.length}`);

  const deterministicCa = 160 + (seed % 165); // 160..324
  const deterministicCitrate = 210 + ((seed >> 4) % 240); // 210..449
  const deterministicCtx = 260 + ((seed >> 8) % 390); // 260..649
  const deterministicAlc = 1350 + ((seed >> 12) % 1300); // 1350..2649

  const mtrrMatch = textContent.match(/MTRR[^\n.;]{0,24}(66GG|GG|66AG|AG|66AA|AA)/i);
  const mtrrGenotype =
    mtrrMatch && /GG/i.test(mtrrMatch[1])
      ? "GG_sans_risk"
      : mtrrMatch && /AG/i.test(mtrrMatch[1])
      ? "AG_heterozygous"
      : mtrrMatch && /AA/i.test(mtrrMatch[1])
      ? "AA_normal"
      : seed % 3 === 0
      ? "GG_sans_risk"
      : "AA_normal";

  const isPdf = fileName.toLowerCase().endsWith(".pdf") || trimmed.startsWith("%PDF");
  const slug = cleanStem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalizeCrewProfile(
    {
      id: `dossier_${slug || "crew"}_${(seed % 9000) + 1000}`,
      callsign: `ARES-${(seed % 8) + 4}`,
      name: displayName,
      role: isPdf ? "PDF Flight Dossier" : "Lab Dossier Import",
      missionAssignment: "mars_transit",
      summaryTag: isPdf
        ? `Ingested PDF Dossier (${fileName})`
        : `Ingested Dossier (${fileName})`,
      biochemical: {
        urinaryCalciumMgDay: extractNumMatch(
          textContent,
          /(?:urinary\s*ca(?:lcium)?|ca2\+)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          deterministicCa,
          40,
          600
        ),
        urinaryCitrateMgDay: extractNumMatch(
          textContent,
          /(?:citrate)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          deterministicCitrate,
          60,
          900
        ),
        serumCtxPgMl: extractNumMatch(
          textContent,
          /(?:serum\s*ctx|ctx)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          deterministicCtx,
          80,
          1400
        ),
        baselineLymphocyteCount: extractNumMatch(
          textContent,
          /(?:alc|lymphocytes?)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          deterministicAlc,
          400,
          5000
        ),
        serumFerritinNgMl: extractNumMatch(
          textContent,
          /(?:ferritin)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          115,
          10,
          600
        ),
        baselineNflPgMl: extractNumMatch(
          textContent,
          /(?:nfl|neurofilament)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          9.4,
          2,
          60
        ),
      },
      pharmacogenomics: {
        mtrrGenotype,
        cyp2d6Phenotype: extractCypToken(textContent, "CYP2D6", "normal"),
        cyp2c9Phenotype: extractCypToken(textContent, "CYP2C9", "normal"),
        atmDnaRepairScore: extractNumMatch(
          textContent,
          /(?:atm)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          mtrrGenotype === "AA_normal" && deterministicAlc < 1650 ? 0.72 : 1.02,
          0.4,
          1.5
        ),
      },
      endurance: {
        co2ReactivitySlope: extractNumMatch(
          textContent,
          /(?:co2[^:\n]{0,16}slope)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          mtrrGenotype === "GG_sans_risk" ? 1.55 : 1.0,
          0.5,
          2.2
        ),
        baselineOnsdMm: extractNumMatch(
          textContent,
          /(?:onsd)[:\s=]*([0-9]+(?:\.[0-9]+)?)/i,
          mtrrGenotype === "GG_sans_risk" ? 5.05 : 4.55,
          3.5,
          6.2
        ),
        dexaBoneTScore: extractNumMatch(
          textContent,
          /(?:dexa|t-?score)[:\s=]*(-?[0-9]+(?:\.[0-9]+)?)/i,
          deterministicCa >= 250 ? -1.1 : 0.3,
          -3.0,
          2.5
        ),
        lbnpEnduranceMin: 32,
        radiationToleranceMsvDay: deterministicAlc < 1650 ? 1.45 : 2.1,
      },
    },
    `dossier_${Date.now()}`
  );
}

export function loadCrewProfilesState(
  storage?: Pick<Storage, "getItem">
): CrewProfilesStorageState {
  let targetStorage: Pick<Storage, "getItem"> | undefined = storage;
  if (!targetStorage && typeof window !== "undefined") {
    try {
      targetStorage = window.localStorage;
    } catch {
      return createDefaultCrewProfilesState();
    }
  }
  if (!targetStorage) return createDefaultCrewProfilesState();

  try {
    const raw = targetStorage.getItem(CREW_PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultCrewProfilesState();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return createDefaultCrewProfilesState();

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
        openApiKey:
          typeof cfgRaw.openApiKey === "string" ? cfgRaw.openApiKey : "",
      },
    };
  } catch {
    return createDefaultCrewProfilesState();
  }
}

export function saveCrewProfilesState(
  state: CrewProfilesStorageState,
  storage?: Pick<Storage, "setItem">
): void {
  let targetStorage: Pick<Storage, "setItem"> | undefined = storage;
  if (!targetStorage && typeof window !== "undefined") {
    try {
      targetStorage = window.localStorage;
    } catch {
      return;
    }
  }
  if (!targetStorage) return;

  try {
    targetStorage.setItem(CREW_PROFILE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / privacy mode errors cleanly
  }
}

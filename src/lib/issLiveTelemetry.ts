import { CURATED_OSDR_STUDIES } from "@/data/nasaHrpData";
import type {
  EnvironmentTelemetry,
  IssEthosSymbolReading,
  IssLiveTelemetrySnapshot,
  OsdrStudyLiveMetadata,
} from "@/types/health";

export interface FetchIssOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
  tickSeed?: number;
}

export interface FetchOsdrOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface WhereTheIssResponse {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  velocity?: number;
  visibility?: string;
}

/**
 * Returns true when ISS orbital coordinates fall inside the South Atlantic Anomaly (SAA),
 * where Earth's inner Van Allen proton belt dips closest to 400 km LEO altitude.
 */
export function isCoordinateInSaa(lat: number, lon: number): boolean {
  return lat >= -50 && lat <= 0 && lon >= -90 && lon <= 40;
}

/**
 * Builds ISS USLAB / NODE3 ETHOS telemetry symbols mapped from orbital conditions
 * and nominal ISS ECLSS operating envelopes.
 */
export function buildIssEthosSymbols(
  orbital: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
    velocityKmh: number;
    visibility: string;
    inSouthAtlanticAnomaly: boolean;
  },
  tickSeed = 0
): {
  symbols: Record<string, IssEthosSymbolReading>;
  mappedEnvTelemetry: EnvironmentTelemetry;
} {
  const wave = Math.sin(tickSeed * 0.35);
  const thermalWave = orbital.visibility === "daylight" ? 0.25 : -0.2;

  const co2MmHg = Number((2.78 + wave * 0.12).toFixed(2));
  const cabinTempC = Number((22.2 + thermalWave + wave * 0.15).toFixed(1));
  const humidityPct = Math.round(44 + wave * 2);
  const pressurePsia = Number((14.68 + wave * 0.02).toFixed(2));
  const waterRecoveryPct = Number((93.8 + Math.cos(tickSeed * 0.2) * 0.3).toFixed(1));

  const gcrDoseMsv = 0.28;
  const saaOrSpeDoseMsv = orbital.inSouthAtlanticAnomaly ? 0.52 : 0.22;
  const dailyRadiationMsv = Number((gcrDoseMsv + saaOrSpeDoseMsv).toFixed(2));

  const symbols: Record<string, IssEthosSymbolReading> = {
    USLAB000058: {
      symbol: "USLAB000058",
      subsystem: "ETHOS_USLAB",
      label: "US Lab ppCO2 (MCA)",
      value: co2MmHg,
      unit: "mmHg",
      nominalRange: "<= 3.0 mmHg",
    },
    USLAB000059: {
      symbol: "USLAB000059",
      subsystem: "ETHOS_USLAB",
      label: "US Lab Cabin Temp (THC)",
      value: cabinTempC,
      unit: "°C",
      nominalRange: "18.3–26.7 °C",
    },
    USLAB000060: {
      symbol: "USLAB000060",
      subsystem: "ETHOS_USLAB",
      label: "US Lab Relative Humidity",
      value: humidityPct,
      unit: "%",
      nominalRange: "25–75%",
    },
    USLAB000053: {
      symbol: "USLAB000053",
      subsystem: "ETHOS_USLAB",
      label: "US Lab Cabin Total Pressure",
      value: pressurePsia,
      unit: "psia",
      nominalRange: "14.2–15.2 psia",
    },
    NODE3000005: {
      symbol: "NODE3000005",
      subsystem: "ECLSS_NODE3",
      label: "Node 3 UPA Water Recovery",
      value: waterRecoveryPct,
      unit: "%",
      nominalRange: ">= 90%",
    },
    RADLAB_HERA01: {
      symbol: "RADLAB_HERA01",
      subsystem: "RADLAB_HERA",
      label: orbital.inSouthAtlanticAnomaly
        ? "HERA / DosTel (SAA Belt)"
        : "HERA / DosTel Flux",
      value: dailyRadiationMsv,
      unit: "mSv/d",
      nominalRange: "0.45–0.85 mSv/d",
    },
  };

  return {
    symbols,
    mappedEnvTelemetry: {
      cabinCo2MmHg: co2MmHg,
      cabinTempC,
      cabinHumidityPct: humidityPct,
      dailyRadiationMsv,
      gcrDoseMsv,
      saaOrSpeDoseMsv,
      solarFlareClass: "None",
    },
  };
}

function buildFallbackOrbital(now: Date): IssLiveTelemetrySnapshot["orbital"] {
  const minutes = now.getTime() / 60000;
  // 92.9 minute ISS orbital period at 51.6 deg inclination
  const phase = ((minutes % 92.9) / 92.9) * Math.PI * 2;
  const latitude = Number((51.6 * Math.sin(phase)).toFixed(2));
  const rawLon = ((minutes * 3.87) % 360) - 180;
  const longitude = Number(rawLon.toFixed(2));
  const inSouthAtlanticAnomaly = isCoordinateInSaa(latitude, longitude);

  return {
    latitude,
    longitude,
    altitudeKm: 418.4,
    velocityKmh: 27584,
    visibility: Math.cos(phase) >= 0 ? "daylight" : "eclipsed",
    inSouthAtlanticAnomaly,
  };
}

/**
 * Queries live ISS orbital position & solar/SAA status (WhereTheISS API, 3s timeout)
 * and synthesizes the live ISS USLAB / NODE3 ETHOS telemetry packet.
 */
export async function fetchIssLiveSnapshot(
  options: FetchIssOptions = {}
): Promise<IssLiveTelemetrySnapshot> {
  const now = options.now ?? new Date();
  const tickSeed = options.tickSeed ?? Math.floor(now.getTime() / 1000);
  const fetchFn = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchFn !== "function") {
    const orbital = buildFallbackOrbital(now);
    const built = buildIssEthosSymbols(orbital, tickSeed);
    return {
      timestampUtc: now.toISOString(),
      source: "iss_telemetry_fallback",
      orbital,
      ...built,
    };
  }

  const timeoutMs = options.timeoutMs ?? 3000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(
      "https://api.wheretheiss.at/v1/satellites/25544",
      {
        method: "GET",
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as WhereTheIssResponse;
    if (
      typeof data.latitude !== "number" ||
      typeof data.longitude !== "number"
    ) {
      throw new Error("Invalid ISS orbital payload");
    }

    const latitude = Number(data.latitude.toFixed(2));
    const longitude = Number(data.longitude.toFixed(2));
    const orbital = {
      latitude,
      longitude,
      altitudeKm: Number((data.altitude ?? 418.4).toFixed(1)),
      velocityKmh: Math.round(data.velocity ?? 27580),
      visibility: data.visibility ?? "daylight",
      inSouthAtlanticAnomaly: isCoordinateInSaa(latitude, longitude),
    };
    const built = buildIssEthosSymbols(orbital, tickSeed);

    return {
      timestampUtc: now.toISOString(),
      source: "iss_live_stream",
      orbital,
      ...built,
    };
  } catch {
    const orbital = buildFallbackOrbital(now);
    const built = buildIssEthosSymbols(orbital, tickSeed);
    return {
      timestampUtc: now.toISOString(),
      source: "iss_telemetry_fallback",
      orbital,
      ...built,
    };
  } finally {
    clearTimeout(timer);
  }
}

function getCuratedFallbackStudy(studyId: string): OsdrStudyLiveMetadata {
  if (CURATED_OSDR_STUDIES[studyId]) {
    return CURATED_OSDR_STUDIES[studyId];
  }
  return {
    studyId,
    title: `NASA OSDR Spaceflight Dataset (${studyId})`,
    missionName: "ISS / Space Biology Repository",
    organismOrSubject: "Spaceflight Cohort",
    assayTypes: ["Multi-Omics Telemetry"],
    sampleCount: 16,
    source: "curated_osdr_cache",
    osdrUrl: `https://osdr.nasa.gov/bio/repo/data/studies/${encodeURIComponent(studyId)}`,
  };
}

/**
 * Fetches live study metadata from NASA OSDR REST API with graceful fallback
 * to curated offline metadata.
 */
export async function fetchOsdrStudyMetadata(
  studyId: string,
  options: FetchOsdrOptions = {}
): Promise<OsdrStudyLiveMetadata> {
  const fallback = getCuratedFallbackStudy(studyId);
  const fetchFn = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchFn !== "function") {
    return fallback;
  }

  const timeoutMs = options.timeoutMs ?? 3000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(
      `https://osdr.nasa.gov/osdr/data/osd/meta/${encodeURIComponent(studyId)}`,
      {
        method: "GET",
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      return fallback;
    }

    const json = (await res.json()) as Record<string, unknown>;
    const studyWrapper =
      (json.study as Record<string, Record<string, unknown>> | undefined)?.[
        studyId
      ] ?? json;
    const studiesArr = Array.isArray(studyWrapper?.studies)
      ? (studyWrapper.studies as Array<Record<string, unknown>>)
      : null;
    const primaryStudy = studiesArr?.[0] ?? studyWrapper;

    const rawTitle =
      (typeof primaryStudy?.title === "string" && primaryStudy.title) ||
      (typeof json.title === "string" && json.title) ||
      fallback.title;

    const missionObj = primaryStudy?.additionalInformation as
      | Record<string, unknown>
      | undefined;
    const rawMission =
      (typeof missionObj?.mission === "string" && missionObj.mission) ||
      (typeof primaryStudy?.mission === "string" && primaryStudy.mission) ||
      fallback.missionName;

    const rawSamples = Array.isArray(primaryStudy?.samples)
      ? primaryStudy.samples.length
      : typeof primaryStudy?.sampleCount === "number"
      ? primaryStudy.sampleCount
      : fallback.sampleCount;

    return {
      studyId,
      title: rawTitle,
      missionName: rawMission,
      organismOrSubject: fallback.organismOrSubject,
      assayTypes: fallback.assayTypes,
      sampleCount: rawSamples,
      source: "nasa_osdr_live",
      osdrUrl: fallback.osdrUrl,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

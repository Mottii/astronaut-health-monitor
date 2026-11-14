import type { EnvironmentTelemetry, SolarFlareClass } from "@/types/health";

export interface DonkiFlareEvent {
  flrID?: string;
  beginTime?: string;
  peakTime?: string;
  classType?: string;
  sourceLocation?: string;
  link?: string;
}

export interface SpaceWeatherStatus {
  source: "nasa_donki_live" | "osdr_radlab_fallback";
  flareClass: SolarFlareClass;
  rawClassType: string;
  peakTime: string;
  recommendedDoseModifierMsv: number;
  summary: string;
  isFallback: boolean;
  referenceUrl: string;
}

export interface FetchSpaceWeatherOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
}

const FLARE_RANK: Record<SolarFlareClass, number> = {
  None: 0,
  C: 1,
  M: 2,
  X: 3,
};

const FLARE_DOSE_MODIFIER_MSV: Record<SolarFlareClass, number> = {
  None: 0,
  C: 0.15,
  M: 0.65,
  X: 1.8,
};

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Extracts normalized NASA solar flare class ('X', 'M', 'C', or 'None') from a DONKI classType string.
 */
export function parseDonkiFlareClass(classType?: string): SolarFlareClass {
  if (!classType) return "None";
  const trimmed = classType.trim().toUpperCase();
  if (trimmed.startsWith("X")) return "X";
  if (trimmed.startsWith("M")) return "M";
  if (trimmed.startsWith("C")) return "C";
  return "None";
}

/**
 * Returns the supplemental daily radiation dose modifier (mSv/day) associated with a flare class.
 */
export function getDoseModifierForFlare(flareClass: SolarFlareClass): number {
  return FLARE_DOSE_MODIFIER_MSV[flareClass];
}

function createOsdrFallbackStatus(reason: string): SpaceWeatherStatus {
  return {
    source: "osdr_radlab_fallback",
    flareClass: "C",
    rawClassType: "C1.8 (OSDR Baseline)",
    peakTime: "Curated ISS/BLEO Baseline",
    recommendedDoseModifierMsv: getDoseModifierForFlare("C"),
    summary: `Offline / Curated OSDR RadLab Fallback (${reason}): DosTel/REM-Lid nominal solar flux (+0.15 mSv/day).`,
    isFallback: true,
    referenceUrl: "https://visualization.osdr.nasa.gov/radlab/gui/data-overview/",
  };
}

/**
 * Fetches recent solar flares from NASA DONKI API (with 3.5s abort timeout) and falls back
 * gracefully to curated NASA OSDR RadLab baselines if offline or rate-limited.
 */
export async function fetchSpaceWeatherAlert(
  options: FetchSpaceWeatherOptions = {}
): Promise<SpaceWeatherStatus> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    return createOsdrFallbackStatus("fetch unavailable");
  }

  const now = options.now ?? new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const apiKey =
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_NASA_API_KEY) ||
    "DEMO_KEY";

  const url = `https://api.nasa.gov/DONKI/FLR?startDate=${formatIsoDate(
    start
  )}&endDate=${formatIsoDate(now)}&api_key=${encodeURIComponent(apiKey)}`;

  const timeoutMs = options.timeoutMs ?? 3500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return createOsdrFallbackStatus(`HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return createOsdrFallbackStatus("unexpected payload");
    }

    if (payload.length === 0) {
      return {
        source: "nasa_donki_live",
        flareClass: "None",
        rawClassType: "Quiet",
        peakTime: formatIsoDate(now),
        recommendedDoseModifierMsv: 0,
        summary: "NASA DONKI Live: Solar background quiet (0 major flares in 7 days).",
        isFallback: false,
        referenceUrl: "https://api.nasa.gov/",
      };
    }

    let strongestEvent: DonkiFlareEvent | null = null;
    let strongestClass: SolarFlareClass = "None";

    for (const item of payload as DonkiFlareEvent[]) {
      const cls = parseDonkiFlareClass(item.classType);
      const clsRank = FLARE_RANK[cls];
      const bestRank = FLARE_RANK[strongestClass];

      if (
        !strongestEvent ||
        clsRank > bestRank ||
        (clsRank === bestRank &&
          (item.peakTime ?? "") > (strongestEvent.peakTime ?? ""))
      ) {
        strongestEvent = item;
        strongestClass = cls;
      }
    }

    const modifier = getDoseModifierForFlare(strongestClass);
    const rawClass = strongestEvent?.classType?.trim() || "Quiet";
    const peakTime = strongestEvent?.peakTime || formatIsoDate(now);

    return {
      source: "nasa_donki_live",
      flareClass: strongestClass,
      rawClassType: rawClass,
      peakTime,
      recommendedDoseModifierMsv: modifier,
      summary:
        strongestClass === "None"
          ? `NASA DONKI Live: Minor solar flux (${rawClass}), nominal radiation modifier.`
          : `NASA DONKI Live: Peak ${rawClass} flare detected (${peakTime}) — +${modifier} mSv/day SPE modifier.`,
      isFallback: false,
      referenceUrl: strongestEvent?.link || "https://api.nasa.gov/",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    return createOsdrFallbackStatus(message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a new EnvironmentTelemetry snapshot incorporating the fetched space weather flare class
 * and radiation dose modifier without mutating the base telemetry object.
 */
export function applySpaceWeatherToTelemetry(
  baseTelemetry: EnvironmentTelemetry,
  weather: SpaceWeatherStatus
): EnvironmentTelemetry {
  const updatedSaaOrSpe = Number(
    (baseTelemetry.saaOrSpeDoseMsv + weather.recommendedDoseModifierMsv).toFixed(
      2
    )
  );
  const updatedTotal = Number(
    (baseTelemetry.gcrDoseMsv + updatedSaaOrSpe).toFixed(2)
  );

  return {
    ...baseTelemetry,
    solarFlareClass: weather.flareClass,
    saaOrSpeDoseMsv: updatedSaaOrSpe,
    dailyRadiationMsv: updatedTotal,
  };
}

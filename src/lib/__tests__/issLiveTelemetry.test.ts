import { describe, expect, it, vi } from "vitest";
import {
  fetchIssLiveSnapshot,
  fetchOsdrStudyMetadata,
  isCoordinateInSaa,
} from "@/lib/issLiveTelemetry";

describe("issLiveTelemetry", () => {
  it("correctly identifies South Atlantic Anomaly (SAA) coordinates", () => {
    expect(isCoordinateInSaa(-24.5, -42.0)).toBe(true);
    expect(isCoordinateInSaa(42.0, -71.0)).toBe(false);
    expect(isCoordinateInSaa(-15.0, 120.0)).toBe(false);
  });

  it("fetches live ISS orbital telemetry and elevates SAA radiation inside SAA coordinates", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        latitude: -26.4,
        longitude: -45.1,
        altitude: 419.2,
        velocity: 27591,
        visibility: "daylight",
      }),
    } as Response);

    const snapshot = await fetchIssLiveSnapshot({
      fetchImpl: mockFetch as unknown as typeof fetch,
      now: new Date("2026-11-14T12:00:00Z"),
      tickSeed: 2,
    });

    expect(snapshot.source).toBe("iss_live_stream");
    expect(snapshot.orbital.inSouthAtlanticAnomaly).toBe(true);
    expect(snapshot.mappedEnvTelemetry.saaOrSpeDoseMsv).toBe(0.52);
    expect(snapshot.symbols.USLAB000058).toBeDefined();
    expect(snapshot.symbols.NODE3000005).toBeDefined();
  });

  it("falls back gracefully to deterministic ISS orbital synthesis when network fails", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("Offline"));

    const snapshot = await fetchIssLiveSnapshot({
      fetchImpl: failingFetch as unknown as typeof fetch,
      now: new Date("2026-11-14T12:00:00Z"),
      tickSeed: 1,
    });

    expect(snapshot.source).toBe("iss_telemetry_fallback");
    expect(snapshot.orbital.altitudeKm).toBe(418.4);
    expect(snapshot.symbols.USLAB000058.unit).toBe("mmHg");
  });

  it("fetches live NASA OSDR study metadata and falls back to curated cache offline", async () => {
    const liveOsdrFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        study: {
          "OSD-48": {
            studies: [
              {
                title: "Live OSDR Rodent Research-1 Study",
                additionalInformation: { mission: "SpaceX-4" },
                samples: [{}, {}, {}],
              },
            ],
          },
        },
      }),
    } as Response);

    const liveMeta = await fetchOsdrStudyMetadata("OSD-48", {
      fetchImpl: liveOsdrFetch as unknown as typeof fetch,
    });
    expect(liveMeta.source).toBe("nasa_osdr_live");
    expect(liveMeta.title).toBe("Live OSDR Rodent Research-1 Study");
    expect(liveMeta.sampleCount).toBe(3);

    const offlineFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    const cachedMeta = await fetchOsdrStudyMetadata("OSD-530", {
      fetchImpl: offlineFetch as unknown as typeof fetch,
    });
    expect(cachedMeta.source).toBe("curated_osdr_cache");
    expect(cachedMeta.studyId).toBe("OSD-530");
  });
});

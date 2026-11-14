import { describe, expect, it, vi } from "vitest";
import { MISSION_ENVIRONMENTS } from "@/data/nasaHrpData";
import {
  applySpaceWeatherToTelemetry,
  fetchSpaceWeatherAlert,
  getDoseModifierForFlare,
  parseDonkiFlareClass,
} from "@/lib/nasaApi";

describe("nasaApi space weather & OSDR fallback service", () => {
  it("parses DONKI flare class strings across X, M, C, and lower/empty values", () => {
    expect(parseDonkiFlareClass("X1.2")).toBe("X");
    expect(parseDonkiFlareClass("M3.4")).toBe("M");
    expect(parseDonkiFlareClass("c2.1")).toBe("C");
    expect(parseDonkiFlareClass("B4.0")).toBe("None");
    expect(parseDonkiFlareClass("")).toBe("None");
    expect(parseDonkiFlareClass(undefined)).toBe("None");
  });

  it("selects the strongest flare from live DONKI response and calculates dose modifier", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { classType: "C1.2", peakTime: "2026-11-12T10:00Z" },
        { classType: "M4.2", peakTime: "2026-11-14T03:15Z" },
      ],
    } as Response);

    const status = await fetchSpaceWeatherAlert({
      fetchImpl: mockFetch as unknown as typeof fetch,
      now: new Date("2026-11-14T05:00:00Z"),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(status.source).toBe("nasa_donki_live");
    expect(status.flareClass).toBe("M");
    expect(status.rawClassType).toBe("M4.2");
    expect(status.peakTime).toBe("2026-11-14T03:15Z");
    expect(status.isFallback).toBe(false);
    expect(status.recommendedDoseModifierMsv).toBe(
      getDoseModifierForFlare("M")
    );
    expect(status.recommendedDoseModifierMsv).toBe(0.65);
  });

  it("falls back gracefully to curated OSDR RadLab data on HTTP 429 or network failure", async () => {
    const rateLimitedFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limit exceeded" }),
    } as Response);

    const rateLimitResult = await fetchSpaceWeatherAlert({
      fetchImpl: rateLimitedFetch as unknown as typeof fetch,
    });
    expect(rateLimitResult.source).toBe("osdr_radlab_fallback");
    expect(rateLimitResult.isFallback).toBe(true);
    expect(rateLimitResult.summary).toContain("OSDR RadLab");

    const networkErrorFetch = vi
      .fn()
      .mockRejectedValue(new Error("Network timeout"));
    const networkResult = await fetchSpaceWeatherAlert({
      fetchImpl: networkErrorFetch as unknown as typeof fetch,
    });
    expect(networkResult.source).toBe("osdr_radlab_fallback");
    expect(networkResult.isFallback).toBe(true);
  });

  it("handles empty DONKI array as quiet solar conditions with zero dose modifier", async () => {
    const emptyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);

    const status = await fetchSpaceWeatherAlert({
      fetchImpl: emptyFetch as unknown as typeof fetch,
    });

    expect(status.source).toBe("nasa_donki_live");
    expect(status.flareClass).toBe("None");
    expect(status.isFallback).toBe(false);
    expect(status.recommendedDoseModifierMsv).toBe(0);
  });

  it("applies space weather radiation modifier onto EnvironmentTelemetry without mutating input", () => {
    const base = { ...MISSION_ENVIRONMENTS.lunar_rover.defaultTelemetry };
    const snapshot = { ...base };

    const updated = applySpaceWeatherToTelemetry(base, {
      source: "nasa_donki_live",
      flareClass: "M",
      rawClassType: "M4.2",
      peakTime: "2026-11-14T03:15Z",
      recommendedDoseModifierMsv: 0.65,
      summary: "Active M4.2 solar flare",
      isFallback: false,
      referenceUrl: "https://api.nasa.gov/",
    });

    expect(base).toEqual(snapshot);
    expect(updated.solarFlareClass).toBe("M");
    expect(updated.saaOrSpeDoseMsv).toBe(
      Number((base.saaOrSpeDoseMsv + 0.65).toFixed(2))
    );
    expect(updated.dailyRadiationMsv).toBe(
      Number((base.gcrDoseMsv + updated.saaOrSpeDoseMsv).toFixed(2))
    );
  });
});

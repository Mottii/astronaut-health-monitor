import { describe, expect, it } from "vitest";
import {
  ALL_BIOLOGICAL_FIELDS,
  REFERENCE_BASELINE,
} from "@/lib/clinicalThresholds";
import {
  CREW_PROFILE_STORAGE_KEY,
  OPEN_API_KEY_SESSION_KEY,
  createDefaultCrewProfilesState,
  loadCrewProfilesState,
  normalizeCrewProfile,
  parseUploadedDossierFile,
  parseUploadedDossierReport,
  saveCrewProfilesState,
} from "@/lib/crewProfileStorage";

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

describe("crewProfileStorage hardening & provenance", () => {
  it("defaults omitted genotype and lab fields strictly to neutral REFERENCE_BASELINE (never GG_sans_risk)", () => {
    const normalized = normalizeCrewProfile({
      id: "neutral_check",
      name: "Spec. Neutral",
      callsign: "ARES-9",
      biochemical: {
        urinaryCalciumMgDay: 215,
      },
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.pharmacogenomics).toEqual(
      REFERENCE_BASELINE.pharmacogenomics
    );
    expect(normalized?.pharmacogenomics.mtrrGenotype).toBe("AA_normal");
    expect(normalized?.biochemical.urinaryCitrateMgDay).toBe(
      REFERENCE_BASELINE.biochemical.urinaryCitrateMgDay
    );
    expect(normalized?.provenance?.suppliedFields).toEqual([
      "urinaryCalciumMgDay",
    ]);
    expect(normalized?.provenance?.defaultedFields).toHaveLength(
      ALL_BIOLOGICAL_FIELDS.length - 1
    );
  });

  it("rejects zero-lab-field JSON/TXT uploads and binary PDFs cleanly", () => {
    const emptyJson = parseUploadedDossierReport(
      "empty.json",
      JSON.stringify({ name: "Empty Astronaut" })
    );
    expect(emptyJson.ok).toBe(false);

    const emptyTxt = parseUploadedDossierReport(
      "empty.txt",
      "Name: Empty Only\nCallsign: ARES-0\n"
    );
    expect(emptyTxt.ok).toBe(false);
    expect(
      parseUploadedDossierFile("empty.txt", "Name: Empty Only")
    ).toBeNull();

    const pdfExt = parseUploadedDossierReport(
      "jsc_lab.pdf",
      "Urinary Calcium: 280\nCitrate: 230\n"
    );
    expect(pdfExt.ok).toBe(false);

    const pdfMagic = parseUploadedDossierReport(
      "disguised.txt",
      "%PDF-1.7\nUrinary Calcium: 280\n"
    );
    expect(pdfMagic.ok).toBe(false);
  });

  it("parses partial dossiers deterministically without hash-fabricated lab values", () => {
    const sample = "Urinary Calcium: 310\nMTRR: AG_heterozygous\n";
    const first = parseUploadedDossierFile("partial_report.txt", sample);
    const second = parseUploadedDossierFile("partial_report.txt", sample);

    expect(first).not.toBeNull();
    expect(first).toEqual(second);
    expect(first?.biochemical.urinaryCalciumMgDay).toBe(310);
    expect(first?.pharmacogenomics.mtrrGenotype).toBe("AG_heterozygous");
    expect(first?.biochemical.serumCtxPgMl).toBe(
      REFERENCE_BASELINE.biochemical.serumCtxPgMl
    );
    expect(first?.provenance?.suppliedFields).toHaveLength(2);
    expect(first?.provenance?.suppliedFields).toEqual(
      expect.arrayContaining(["urinaryCalciumMgDay", "mtrrGenotype"])
    );
    expect(first?.provenance?.defaultedFields).toHaveLength(13);
  });

  it("never stores openApiKey in localStorage and round-trips it cleanly via sessionStorage", () => {
    const localMock = createMemoryStorage();
    const sessionMock = createMemoryStorage();

    const state = createDefaultCrewProfilesState();
    state.inferenceConfig.mode = "open_api";
    state.inferenceConfig.openApiKey = "sk-secret-demo-token-1234";
    state.updatedAt = 12345;

    saveCrewProfilesState(state, localMock, sessionMock);

    const rawLocal = localMock.getItem(CREW_PROFILE_STORAGE_KEY);
    expect(rawLocal).not.toBeNull();
    expect(rawLocal).not.toContain("sk-secret-demo-token-1234");
    expect(
      JSON.parse(rawLocal!).inferenceConfig.openApiKey
    ).toBeUndefined();
    expect(sessionMock.getItem(OPEN_API_KEY_SESSION_KEY)).toBe(
      "sk-secret-demo-token-1234"
    );

    const loaded = loadCrewProfilesState(localMock, sessionMock);
    expect(loaded.inferenceConfig.openApiKey).toBe("sk-secret-demo-token-1234");
    expect(loaded.updatedAt).toBe(12345);

    const loadedNoSession = loadCrewProfilesState(
      localMock,
      createMemoryStorage()
    );
    expect(loadedNoSession.inferenceConfig.openApiKey).toBe("");
  });
});

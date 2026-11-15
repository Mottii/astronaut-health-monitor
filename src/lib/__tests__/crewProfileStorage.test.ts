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

  it("converts SI/alternate clinical units in TXT/CSV and rejects out-of-range or spot-concentration values instead of clamping", () => {
    const siTxt = [
      "Name: Cmdr. SI Units",
      "Callsign: ARES-SI",
      "Role: Payload Commander",
      "Mission: Lunar Rover",
      "Urinary Calcium: 6.5 mmol/d",
      "Urinary Citrate: 2.0 mmol/d",
      "Serum CTX: 0.42 ng/mL",
      "ALC: 2.1 x10^9/L",
      "Ferritin: 900 ng/mL",
    ].join("\n");

    const parsed = parseUploadedDossierReport("si_report.txt", siTxt);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const p = parsed.profile;
    expect(p.role).toBe("Payload Commander");
    expect(p.missionAssignment).toBe("lunar_rover");
    // 6.5 mmol/d * 40 = 260 mg/day
    expect(p.biochemical.urinaryCalciumMgDay).toBe(260);
    // 2.0 mmol/d * 192 = 384 mg/day
    expect(p.biochemical.urinaryCitrateMgDay).toBe(384);
    // 0.42 ng/mL * 1000 = 420 pg/mL
    expect(p.biochemical.serumCtxPgMl).toBe(420);
    // 2.1 x10^9/L * 1000 = 2100 /uL
    expect(p.biochemical.baselineLymphocyteCount).toBe(2100);
    expect(p.provenance?.convertedFields).toHaveLength(4);

    // Ferritin 900 is out of bounds [10, 600] -> rejected and defaulted to REFERENCE_BASELINE (110), NOT clamped to 600
    expect(p.biochemical.serumFerritinNgMl).toBe(
      REFERENCE_BASELINE.biochemical.serumFerritinNgMl
    );
    expect(p.provenance?.suppliedFields).not.toContain("serumFerritinNgMl");
    expect(p.provenance?.defaultedFields).toContain("serumFerritinNgMl");
    expect(
      p.provenance?.rejectedFields?.some((r) => r.field === "serumFerritinNgMl")
    ).toBe(true);

    // All-rejected file returns specific diagnostic listing rejected fields
    const allBad = parseUploadedDossierReport(
      "bad_units.txt",
      "Urinary Calcium: 8.5 mg/dL\nFerritin: 950\nCTX: 0.4\n"
    );
    expect(allBad.ok).toBe(false);
    if (!allBad.ok) {
      expect(allBad.error).toContain("rejected");
      expect(allBad.error).toContain("urinaryCalciumMgDay");
      expect(allBad.error).toContain("serumFerritinNgMl");
    }
  });

  it("preserves provenance when re-uploading an exported partial profile JSON and blocks spoofed provenance", () => {
    const partial = parseUploadedDossierFile(
      "partial.txt",
      "Urinary Calcium: 290\nMTRR: 66GG\n"
    );
    expect(partial).not.toBeNull();
    expect(partial?.provenance?.suppliedFields).toEqual([
      "mtrrGenotype",
      "urinaryCalciumMgDay",
    ]);

    const exportedJson = JSON.stringify(partial, null, 2);
    const reingested = parseUploadedDossierReport(
      "exported-partial.json",
      exportedJson
    );
    expect(reingested.ok).toBe(true);
    if (reingested.ok) {
      expect(reingested.profile.provenance?.suppliedFields).toEqual([
        "mtrrGenotype",
        "urinaryCalciumMgDay",
      ]);
      expect(reingested.profile.provenance?.defaultedFields).toHaveLength(13);
    }

    // Spoofed provenance claiming out-of-range field is supplied gets invalidated
    const spoofed = normalizeCrewProfile({
      name: "Spoofed",
      biochemical: { urinaryCalciumMgDay: 9999 },
      provenance: {
        sourceType: "json_upload",
        suppliedFields: ["urinaryCalciumMgDay"],
        defaultedFields: ALL_BIOLOGICAL_FIELDS.filter(
          (f) => f !== "urinaryCalciumMgDay"
        ),
      },
    });
    expect(spoofed?.provenance?.suppliedFields).toEqual([]);
    expect(spoofed?.provenance?.rejectedFields).toHaveLength(1);

    // Spoofed provenance claiming a non-baseline abnormal value is "defaulted" gets invalidated
    const spoofedDefaulted = normalizeCrewProfile({
      name: "Spoofed Defaulted",
      biochemical: { urinaryCalciumMgDay: 200, serumCtxPgMl: 1200 },
      provenance: {
        sourceType: "json_upload",
        suppliedFields: ["urinaryCalciumMgDay"],
        defaultedFields: ALL_BIOLOGICAL_FIELDS.filter(
          (f) => f !== "urinaryCalciumMgDay"
        ),
      },
    });
    expect(spoofedDefaulted?.provenance?.suppliedFields).toContain(
      "serumCtxPgMl"
    );
  });

  it("enforces word boundaries, clinical shorthand, flat JSON, 1-element arrays, quoted CSVs, and openApiModelName persistence", () => {
    // "calcium" must not match "alc", "inflammation" must not match "nfl", "atmosphere" must not match "atm",
    // while "Ca2+: 245" and spaced "2.1 x 10^9/L" and "mmol/24hr" must match cleanly
    const collisionTxt =
      "Calcium: 210\nInflammation: 5\nAtmosphere: 1.0\nCa2+: 6.5 mmol/24hr\nALC: 2.1 x 10^9/L\n";
    const parsedCollision = parseUploadedDossierFile(
      "collision.txt",
      collisionTxt
    );
    expect(parsedCollision?.provenance?.suppliedFields).toEqual([
      "urinaryCalciumMgDay",
      "baselineLymphocyteCount",
    ]);
    expect(parsedCollision?.biochemical.urinaryCalciumMgDay).toBe(260);
    expect(parsedCollision?.biochemical.baselineLymphocyteCount).toBe(2100);

    // 2-line key-value CSV and 3-column Parameter,Value,Unit CSV
    const twoLineKvCsv = "Urinary Calcium,280\nUrinary Citrate,350\n";
    const parsedKvCsv = parseUploadedDossierFile("kv2.csv", twoLineKvCsv);
    expect(parsedKvCsv?.biochemical.urinaryCalciumMgDay).toBe(280);
    expect(parsedKvCsv?.biochemical.urinaryCitrateMgDay).toBe(350);

    const threeColCsv =
      "Parameter,Value,Unit\nUrinary Calcium,6.5,mmol/d\nUrinary Citrate,2.0,mmol/d\n";
    const parsedThreeCol = parseUploadedDossierFile("lab3.csv", threeColCsv);
    expect(parsedThreeCol?.biochemical.urinaryCalciumMgDay).toBe(260);
    expect(parsedThreeCol?.biochemical.urinaryCitrateMgDay).toBe(384);

    // Multi-row horizontal table CSV (>1 astronaut rows) is rejected with clear diagnostic
    const multiRowHorizontalCsv =
      "name,callsign,urinaryCalciumMgDay\nCmdr. Vance,ARES-1,165\nDr. Chen,ARES-2,295\n";
    const multiRowRes = parseUploadedDossierReport(
      "multi.csv",
      multiRowHorizontalCsv
    );
    expect(multiRowRes.ok).toBe(false);
    if (!multiRowRes.ok) {
      expect(multiRowRes.error).toContain("2 crew data rows");
    }

    // Flat JSON + shorthand genotypes/phenotypes + 1-element array
    const flatArrayJson = JSON.stringify([
      {
        name: "Dr. Flat Array",
        callsign: "ARES-8",
        urinary_calcium: 275,
        alc: 1950,
        mtrr: "66GG",
        cyp2d6: "Ultra-Rapid",
        cyp2c9: "Extensive",
      },
    ]);
    const parsedFlat = parseUploadedDossierFile("flat.json", flatArrayJson);
    expect(parsedFlat).not.toBeNull();
    expect(parsedFlat?.biochemical.urinaryCalciumMgDay).toBe(275);
    expect(parsedFlat?.biochemical.baselineLymphocyteCount).toBe(1950);
    expect(parsedFlat?.pharmacogenomics.mtrrGenotype).toBe("GG_sans_risk");
    expect(parsedFlat?.pharmacogenomics.cyp2d6Phenotype).toBe("ultra_rapid");
    expect(parsedFlat?.pharmacogenomics.cyp2c9Phenotype).toBe("normal");

    // Quoted CSV with commas inside quotes
    const quotedCsv =
      'name,callsign,role,missionAssignment,urinaryCalciumMgDay\n"Vance, Elena",ARES-1,"Commander, ISS",ISS,215\n';
    const parsedCsv = parseUploadedDossierFile("quoted.csv", quotedCsv);
    expect(parsedCsv?.name).toBe("Vance, Elena");
    expect(parsedCsv?.role).toBe("Commander, ISS");
    expect(parsedCsv?.missionAssignment).toBe("iss_orbit");
    expect(parsedCsv?.biochemical.urinaryCalciumMgDay).toBe(215);

    // openApiModelName persistence
    const localMock = createMemoryStorage();
    const state = createDefaultCrewProfilesState();
    state.inferenceConfig.openApiModelName = "meditron-70b";
    saveCrewProfilesState(state, localMock);
    const reloaded = loadCrewProfilesState(localMock);
    expect(reloaded.inferenceConfig.openApiModelName).toBe("meditron-70b");
  });
});

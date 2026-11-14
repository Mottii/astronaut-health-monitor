import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREW_PROFILES,
  DEMO_SCENARIOS,
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
} from "@/data/nasaHrpData";
import {
  createDefaultCrewProfilesState,
  loadCrewProfilesState,
  normalizeCrewProfile,
  parseUploadedDossierFile,
  parseUploadedDossierReport,
  saveCrewProfilesState,
} from "@/lib/crewProfileStorage";
import {
  applyCountermeasureToState,
  evaluateCrewHealth,
} from "@/lib/triageEngine";
import {
  computeOrganSensitivityMultipliers,
  generateTwinConsultationSummary,
  runPreFlightQualificationSuite,
  simulatePersonalizedDrugResponse,
} from "@/lib/twinEngine";
import type { BodySystemId } from "@/types/health";

describe("twinEngine & crew biological profiling", () => {
  const vance = DEFAULT_CREW_PROFILES.find((p) => p.id === "ares_1_vance")!;
  const chen = DEFAULT_CREW_PROFILES.find((p) => p.id === "ares_2_chen")!;
  const korolev = DEFAULT_CREW_PROFILES.find((p) => p.id === "ares_3_korolev")!;

  it("derives distinct organ sensitivity multipliers from blood biochemistry, SOMA genetics, and endurance", () => {
    const vMults = computeOrganSensitivityMultipliers(vance);
    const cMults = computeOrganSensitivityMultipliers(chen);
    const kMults = computeOrganSensitivityMultipliers(korolev);

    // Vance (MTRR 66GG + 1.65x CO2 slope + 5.1mm ONSD) -> highest neuro_ocular sensitivity
    expect(vMults.neuro_ocular).toBeGreaterThan(1.3);
    expect(vMults.neuro_ocular).toBeGreaterThan(kMults.neuro_ocular);

    // Chen (Urinary Ca2+ 295 mg/d + Citrate 205 + DEXA -1.3) -> highest musculoskeletal_renal sensitivity
    expect(cMults.musculoskeletal_renal).toBeGreaterThan(1.35);
    expect(cMults.musculoskeletal_renal).toBeGreaterThan(
      vMults.musculoskeletal_renal
    );

    // Korolev (ATM 0.68 + ALC 1420) -> highest immune_hematology sensitivity
    expect(kMults.immune_hematology).toBeGreaterThan(1.3);
    expect(kMults.immune_hematology).toBeGreaterThan(vMults.immune_hematology);
  });

  it("differentiates evaluateCrewHealth neuro_ocular triage scores on identical hypercapnic telemetry", () => {
    const nominal = DEMO_SCENARIOS[0];
    const borderlineSansVitals = {
      ...nominal.vitals,
      ocularFinding: "blurry_near" as const,
      bloodPressureSystolic: 132,
      bloodPressureDiastolic: 84,
    };
    const borderlineEnv = {
      ...MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
      cabinCo2MmHg: 3.6,
    };

    const evalVance = evaluateCrewHealth(
      borderlineSansVitals,
      borderlineEnv,
      "iss_orbit",
      vance
    );
    const evalKorolev = evaluateCrewHealth(
      borderlineSansVitals,
      borderlineEnv,
      "iss_orbit",
      korolev
    );

    expect(evalVance.systems.neuro_ocular.score).toBeLessThan(
      evalKorolev.systems.neuro_ocular.score
    );
    expect(evalVance.systems.neuro_ocular.findings[0]).toContain("MTRR");
  });

  it("flags Acetazolamide 250 mg as contraindicated in hypercalciuric Dr. Chen and triggers cross-organ renal stone cascade when applied", () => {
    const sans = DEMO_SCENARIOS.find((s) => s.id === "sans_co2_fluid_shift")!;
    const acetazolamide = EXECUTABLE_COUNTERMEASURES.neuro_ocular.find(
      (a) => a.id === "neuro_acetazolamide_rx"
    )!;

    const predVance = simulatePersonalizedDrugResponse(
      vance,
      acetazolamide,
      sans.vitals,
      sans.envTelemetry
    );
    const predChen = simulatePersonalizedDrugResponse(
      chen,
      acetazolamide,
      sans.vitals,
      sans.envTelemetry
    );

    expect(predVance.contraindicationSeverity).not.toBe("contraindicated");
    expect(predChen.contraindicationSeverity).toBe("contraindicated");
    expect(predChen.secondarySystemImpact?.systemId).toBe(
      "musculoskeletal_renal"
    );

    // Apply Acetazolamide in-silico on Chen -> partial ocular relief (remains blurry_near at 62% efficacy),
    // bounded -350 mL diuretic depletion without resetting ARED exercise, and active drug cascade fires red renal risk.
    const postChen = applyCountermeasureToState(
      sans.vitals,
      sans.envTelemetry,
      acetazolamide,
      chen
    );
    expect(postChen.vitals.ocularFinding).toBe("blurry_near");
    expect(postChen.vitals.hydrationMl).toBe(sans.vitals.hydrationMl - 350);
    expect(postChen.vitals.aredExerciseCompleted).toBe(
      sans.vitals.aredExerciseCompleted
    );

    const postChenEval = evaluateCrewHealth(
      postChen.vitals,
      postChen.envTelemetry,
      "iss_orbit",
      chen,
      { activeDrugIds: ["neuro_acetazolamide_rx"] }
    );
    expect(postChenEval.systems.musculoskeletal_renal.status).toBe("red");
    expect(
      postChenEval.activeCascades.some(
        (c) => c.id === "drug_acetazolamide_renal"
      )
    ).toBe(true);
  });

  it("runs all 4 JSC pre-flight qualification assays cleanly", () => {
    const chenQuals = runPreFlightQualificationSuite(chen);
    expect(chenQuals).toHaveLength(4);
    const acetazolamideQual = chenQuals.find(
      (q) => q.id === "qual_acetazolamide_pk"
    );
    expect(acetazolamideQual?.status).toBe("contraindicated");
  });

  it("safely validates, saves, and loads imported crew profiles in storage", () => {
    const memoryMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memoryMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memoryMap.set(k, v);
      },
    };

    const custom = normalizeCrewProfile({
      id: "uploaded_custom_1",
      callsign: "ARES-9",
      name: "Dr. Kira Patel",
      biochemical: { urinaryCalciumMgDay: 310 },
      pharmacogenomics: { mtrrGenotype: "GG_sans_risk" },
    });
    expect(custom).not.toBeNull();

    const state = createDefaultCrewProfilesState();
    state.profiles.push(custom!);
    state.activeProfileId = custom!.id;
    saveCrewProfilesState(state, mockStorage);

    const reloaded = loadCrewProfilesState(mockStorage);
    expect(reloaded.activeProfileId).toBe("uploaded_custom_1");
    expect(
      reloaded.profiles.find((p) => p.id === "uploaded_custom_1")?.biochemical
        .urinaryCalciumMgDay
    ).toBe(310);
  });

  it("ingests structured JSON/TXT/CSV dossiers cleanly and rejects binary PDFs offline", () => {
    const jsonProfile = parseUploadedDossierFile(
      "cmdr-lin.json",
      JSON.stringify({
        id: "lin_json",
        callsign: "ARES-7",
        name: "Dr. Mei Lin",
        biochemical: { urinaryCalciumMgDay: 265, urinaryCitrateMgDay: 220 },
      })
    );
    expect(jsonProfile?.id).toBe("lin_json");
    expect(jsonProfile?.biochemical.urinaryCalciumMgDay).toBe(265);

    const txtProfile = parseUploadedDossierFile(
      "ares_4_santos_jsc_lab.txt",
      "Urinary Calcium: 280\nCitrate: 230\nMTRR: GG\nCYP2C9: poor\n"
    );
    expect(txtProfile).not.toBeNull();
    expect(txtProfile?.biochemical.urinaryCalciumMgDay).toBe(280);
    expect(txtProfile?.biochemical.urinaryCitrateMgDay).toBe(230);
    expect(txtProfile?.pharmacogenomics.mtrrGenotype).toBe("GG_sans_risk");
    expect(txtProfile?.pharmacogenomics.cyp2c9Phenotype).toBe("poor");

    const csvProfile = parseUploadedDossierFile(
      "ares_5_okafor.csv",
      "name,callsign,urinaryCalciumMgDay,urinaryCitrateMgDay\nDr. Okafor,ARES-5,245,310\n"
    );
    expect(csvProfile?.biochemical.urinaryCalciumMgDay).toBe(245);
    expect(csvProfile?.biochemical.urinaryCitrateMgDay).toBe(310);

    const pdfRejected = parseUploadedDossierReport(
      "ares_4_santos_jsc_lab.pdf",
      "%PDF-1.4\nUrinary Calcium: 280\nCitrate: 230\n"
    );
    expect(pdfRejected.ok).toBe(false);
    expect(
      parseUploadedDossierFile(
        "ares_4_santos_jsc_lab.pdf",
        "%PDF-1.4\nUrinary Calcium: 280\n"
      )
    ).toBeNull();
  });

  it("keeps organ sensitivity multipliers strictly below ceiling without flat-top clamping and remains monotonic", () => {
    const secondarySystems: BodySystemId[] = [
      "cardiovascular",
      "metabolic_endocrine",
      "behavioral_circadian",
    ];
    for (const profile of [vance, chen, korolev]) {
      const mults = computeOrganSensitivityMultipliers(profile);
      for (const value of Object.values(mults)) {
        expect(value).toBeGreaterThanOrEqual(0.7);
        expect(value).toBeLessThan(1.85);
      }
      for (const sec of secondarySystems) {
        expect(mults[sec]).toBeLessThan(1.65);
      }
    }

    // Calcium sweep: raising Ca2+ strictly increases musculoskeletal_renal multiplier
    const caValues = [120, 250, 380, 550];
    const caMults = caValues.map((ca) =>
      computeOrganSensitivityMultipliers({
        ...vance,
        biochemical: { ...vance.biochemical, urinaryCalciumMgDay: ca },
      }).musculoskeletal_renal
    );
    for (let i = 1; i < caMults.length; i++) {
      expect(caMults[i]).toBeGreaterThan(caMults[i - 1]);
      expect(caMults[i]).toBeLessThan(1.85);
    }

    // Citrate sweep: lowering citrate strictly increases musculoskeletal_renal multiplier
    const citrateValues = [500, 260, 150, 80];
    const citrateMults = citrateValues.map((citrate) =>
      computeOrganSensitivityMultipliers({
        ...vance,
        biochemical: { ...vance.biochemical, urinaryCitrateMgDay: citrate },
      }).musculoskeletal_renal
    );
    for (let i = 1; i < citrateMults.length; i++) {
      expect(citrateMults[i]).toBeGreaterThan(citrateMults[i - 1]);
      expect(citrateMults[i]).toBeLessThan(1.85);
    }

    // ATM repair sweep: lowering ATM repair score strictly increases immune_hematology multiplier
    const atmValues = [1.2, 0.9, 0.7, 0.5];
    const atmMults = atmValues.map((atm) =>
      computeOrganSensitivityMultipliers({
        ...korolev,
        pharmacogenomics: {
          ...korolev.pharmacogenomics,
          atmDnaRepairScore: atm,
        },
      }).immune_hematology
    );
    for (let i = 1; i < atmMults.length; i++) {
      expect(atmMults[i]).toBeGreaterThan(atmMults[i - 1]);
      expect(atmMults[i]).toBeLessThan(1.85);
    }
  });

  it("decouples bone/renal qualification assay from the acetazolamide pharmacological verdict", async () => {
    const chenQuals = runPreFlightQualificationSuite(chen);
    const acetazolamideAssay = chenQuals.find(
      (q) => q.id === "qual_acetazolamide_pk"
    );
    const boneAssay = chenQuals.find((q) => q.id === "qual_bone_renal");

    expect(acetazolamideAssay?.status).toBe("contraindicated");
    expect(boneAssay?.status).toBe("caution");

    const nominalEval = evaluateCrewHealth(
      DEMO_SCENARIOS[0].vitals,
      MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
      "iss_orbit",
      chen
    );
    const consultation = await generateTwinConsultationSummary(chen, nominalEval, {
      mode: "local_mechanistic",
      localEndpointUrl: "http://localhost:11434/v1/chat/completions",
      localModelName: "llama3.2",
      openApiEndpointUrl: "/api/twin-simulate",
      openApiKey: "",
    });
    expect(consultation.source).toBe("deterministic");
    expect(consultation.deterministicGuardrail).toContain("CONTRAINDICATED");
  });
});

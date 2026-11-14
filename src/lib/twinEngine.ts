import {
  EXECUTABLE_COUNTERMEASURES,
  MISSION_ENVIRONMENTS,
} from "@/data/nasaHrpData";
import { assessRenalStoneRisk, RENAL_STONE } from "@/lib/clinicalThresholds";
import type {
  AstronautBiologicalProfile,
  BodySystemId,
  CountermeasureActionSpec,
  CypMetabolizerPhenotype,
  DrugSimulationPrediction,
  EnvironmentTelemetry,
  HealthEvaluationResult,
  OrganSensitivityMultipliers,
  PreFlightQualificationTestResult,
  TwinInferenceConfig,
  VitalReadings,
} from "@/types/health";

const ACETAZOLAMIDE_RULE = {
  renalRiskEfficacyPct: 62,
  mtrrRiskEfficacyPct: 84,
  nominalEfficacyPct: 91,
  renalRiskHalfLifeH: 8.5,
  nominalHalfLifeH: 6.2,
  diureticDepletionMl: 350,
  renalScoreDelta: -28,
} as const;

const LBNP_RULE = {
  mtrrHighSlopeEfficacyPct: 92,
  nominalEfficacyPct: 95,
  equivalentWindowH: 4.0,
} as const;

const POTASSIUM_CITRATE_RULE = {
  atRiskEfficacyPct: 96,
  nominalEfficacyPct: 93,
} as const;

const CYP_BASE_HALF_LIFE_H = 5.5;
const OLLAMA_PROBE_TIMEOUT_MS = 2000;
const LOCAL_LLM_TIMEOUT_MS = 30000;
const OPEN_API_TIMEOUT_MS = 15000;

/**
 * Smooth asymptotic saturation curve so extreme risk profiles approach the
 * ceiling smoothly without saturating or losing monotonicity.
 */
function softMultiplier(load: number, min: number, asymptote: number): number {
  const safeLoad = Number.isFinite(load) ? Math.max(0, load) : 0;
  const raw = min + (asymptote - min) * (1 - Math.exp(-safeLoad));
  return Number(raw.toFixed(2));
}

/**
 * Derives 6-system sensitivity weights from pre-flight NASA SSM biochemistry,
 * SOMA pharmacogenomics (MTRR/CYP450/ATM), and JSC chamber stress endurance slopes.
 * Core systems stay strictly below 1.85x; secondary systems strictly below 1.65x.
 */
export function computeOrganSensitivityMultipliers(
  profile: AstronautBiologicalProfile
): OrganSensitivityMultipliers {
  const { biochemical, pharmacogenomics, endurance } = profile;

  const mtrrLoad =
    pharmacogenomics.mtrrGenotype === "GG_sans_risk"
      ? 0.5
      : pharmacogenomics.mtrrGenotype === "AG_heterozygous"
      ? 0.22
      : -0.08;
  const neuroLoad =
    0.3 +
    mtrrLoad +
    (endurance.co2ReactivitySlope - 1.0) * 0.65 +
    (endurance.baselineOnsdMm - 4.6) * 0.55;

  const caLoad = (biochemical.urinaryCalciumMgDay - 180) / 240;
  const citrateLoad = (380 - biochemical.urinaryCitrateMgDay) / 380;
  const ctxLoad = (biochemical.serumCtxPgMl - 320) / 900;
  const dexaLoad = -endurance.dexaBoneTScore * 0.2;
  const renalLoad = 0.3 + caLoad + citrateLoad + ctxLoad + dexaLoad;

  const atmLoad = (1.0 - pharmacogenomics.atmDnaRepairScore) * 1.45;
  const alcLoad = (2100 - biochemical.baselineLymphocyteCount) / 1400;
  const radTolLoad = (2.0 - endurance.radiationToleranceMsvDay) * 0.6;
  const immuneLoad = 0.3 + atmLoad + alcLoad + radTolLoad;

  const cvLoad =
    0.33 +
    (32 - endurance.lbnpEnduranceMin) * 0.03 +
    (biochemical.serumFerritinNgMl - 110) / 400;

  const cyp2c9Load =
    pharmacogenomics.cyp2c9Phenotype === "poor"
      ? 0.35
      : pharmacogenomics.cyp2c9Phenotype === "intermediate"
      ? 0.15
      : 0;
  const metLoad =
    0.33 + cyp2c9Load + (biochemical.serumFerritinNgMl - 110) / 350;

  const behLoad =
    0.33 +
    (biochemical.baselineNflPgMl - 9.5) * 0.08 +
    (endurance.co2ReactivitySlope - 1.0) * 0.35;

  return {
    neuro_ocular: softMultiplier(neuroLoad, 0.7, 1.84),
    cardiovascular: softMultiplier(cvLoad, 0.75, 1.64),
    musculoskeletal_renal: softMultiplier(renalLoad, 0.7, 1.84),
    metabolic_endocrine: softMultiplier(metLoad, 0.75, 1.64),
    immune_hematology: softMultiplier(immuneLoad, 0.7, 1.84),
    behavioral_circadian: softMultiplier(behLoad, 0.75, 1.64),
  };
}

function getPhenotypePkParams(
  phenotype: CypMetabolizerPhenotype,
  baseHalfLifeHours: number
): { halfLifeHours: number; doseNote: string; efficacyBonus: number } {
  switch (phenotype) {
    case "ultra_rapid":
      return {
        halfLifeHours: Number((baseHalfLifeHours * 0.58).toFixed(1)),
        doseNote: "Ultra-Rapid metabolizer: split q8h dosing (+25% coverage)",
        efficacyBonus: -6,
      };
    case "intermediate":
      return {
        halfLifeHours: Number((baseHalfLifeHours * 1.32).toFixed(1)),
        doseNote: "Intermediate clearance: reduce maintenance dose by 20%",
        efficacyBonus: 2,
      };
    case "poor":
      return {
        halfLifeHours: Number((baseHalfLifeHours * 1.85).toFixed(1)),
        doseNote: "Poor metabolizer: 50% dose reduction required to avoid toxicity",
        efficacyBonus: -8,
      };
    default:
      return {
        halfLifeHours: baseHalfLifeHours,
        doseNote: "Standard 100% flight formulary dosing",
        efficacyBonus: 4,
      };
  }
}

/**
 * Predicts rule-based personalized efficacy, CYP450 clearance scaling, and
 * cross-organ contraindications for a countermeasure on an astronaut's BioTwin.
 */
export function simulatePersonalizedDrugResponse(
  profile: AstronautBiologicalProfile,
  action: CountermeasureActionSpec,
  currentVitals: VitalReadings,
  _currentEnv: EnvironmentTelemetry
): DrugSimulationPrediction {
  const { biochemical, pharmacogenomics, endurance } = profile;
  const stoneRisk = assessRenalStoneRisk(profile);

  // Carbonic anhydrase inhibitor (Acetazolamide) -> Cross-organ renal stone trap
  if (action.id === "neuro_acetazolamide_rx") {
    if (stoneRisk.atRisk) {
      return {
        actionId: action.id,
        basis: "profile_rule",
        efficacyPct: ACETAZOLAMIDE_RULE.renalRiskEfficacyPct,
        recommendedDoseAdjustment: "AVOID Rx — Switch to LBNP + CDRA Scrub",
        clearanceHalfLifeHours: ACETAZOLAMIDE_RULE.renalRiskHalfLifeH,
        contraindicationSeverity: "contraindicated",
        contraindicationWarning: `CONTRAINDICATED FOR ${profile.callsign}: Carbonic anhydrase inhibition alkalinizes urine (pH > 7.2) and depletes citrate (${biochemical.urinaryCitrateMgDay} mg/d), precipitating CaPO4 renal stones (${stoneRisk.factors.join(", ")}; Ca2+ ${biochemical.urinaryCalciumMgDay} mg/d, DEXA ${endurance.dexaBoneTScore.toFixed(1)}).`,
        secondarySystemImpact: {
          systemId: "musculoskeletal_renal",
          scoreDelta: ACETAZOLAMIDE_RULE.renalScoreDelta,
          vitalsPatch: {
            hydrationMl: Math.max(
              400,
              currentVitals.hydrationMl - ACETAZOLAMIDE_RULE.diureticDepletionMl
            ),
          },
          mechanism:
            "Acetazolamide-induced diuresis and proximal tubular alkalinization precipitate acute nephrolithiasis in stone-susceptible profiles.",
        },
        mechanisticRationale:
          "Blocks choroid plexus bicarbonate transport to reduce CSF secretion, but induces osmotic/bicarbonate diuresis and hypocitraturic urine alkalinization.",
      };
    }

    const isMtrrRisk = pharmacogenomics.mtrrGenotype === "GG_sans_risk";
    return {
      actionId: action.id,
      basis: "profile_rule",
      efficacyPct: isMtrrRisk
        ? ACETAZOLAMIDE_RULE.mtrrRiskEfficacyPct
        : ACETAZOLAMIDE_RULE.nominalEfficacyPct,
      recommendedDoseAdjustment: isMtrrRisk
        ? "250 mg PO + B-Complex / Folate Cofactor Protocol"
        : "Standard 250 mg PO q12h",
      clearanceHalfLifeHours: ACETAZOLAMIDE_RULE.nominalHalfLifeH,
      contraindicationSeverity: isMtrrRisk ? "caution" : "none",
      contraindicationWarning: isMtrrRisk
        ? "MTRR 66GG allele detected: co-administer methylfolate/B-vitamins + LBNP cuffs for durable optic disc relief."
        : undefined,
      mechanisticRationale: `Normocalciuric renal reserve (Ca2+ <= ${RENAL_STONE.caHigh} mg/d, Citrate >= ${RENAL_STONE.citrateLow} mg/d) permits short-course ICP reduction.`,
    };
  }

  // Non-pharmacological LBNP for SANS
  if (action.id === "neuro_lbnp_cuffs") {
    const isMtrrRisk = pharmacogenomics.mtrrGenotype === "GG_sans_risk";
    const efficacy =
      isMtrrRisk && endurance.co2ReactivitySlope > 1.3
        ? LBNP_RULE.mtrrHighSlopeEfficacyPct
        : LBNP_RULE.nominalEfficacyPct;
    return {
      actionId: action.id,
      basis: "profile_rule",
      efficacyPct: efficacy,
      recommendedDoseAdjustment:
        endurance.lbnpEnduranceMin < 30
          ? `Graduated -25 mmHg (2 x 20 min cycles to respect ${endurance.lbnpEnduranceMin}m LBNP baroreflex limit)`
          : "Full -35 mmHg 30-min LBNP draw",
      clearanceHalfLifeHours: LBNP_RULE.equivalentWindowH,
      contraindicationSeverity: "none",
      mechanisticRationale:
        "Zero-nephrotoxicity mechanical venous pooling reverses cephalad fluid shift without disturbing urinary citrate or pH.",
    };
  }

  // Renal stone citrate prophylaxis (non-CYP urinary alkalinizing electrolyte)
  if (action.protectiveFor === "renal_stone") {
    return {
      actionId: action.id,
      basis: "profile_rule",
      efficacyPct: stoneRisk.atRisk
        ? POTASSIUM_CITRATE_RULE.atRiskEfficacyPct
        : POTASSIUM_CITRATE_RULE.nominalEfficacyPct,
      recommendedDoseAdjustment: stoneRisk.atRisk
        ? "Priority Stone Prophylaxis — 20 mEq + 650 mL bolus (restores urinary citrate)"
        : "Standard prophylaxis (20 mEq + 650 mL bolus)",
      clearanceHalfLifeHours: 0,
      contraindicationSeverity: "none",
      mechanisticRationale:
        "Exogenous potassium citrate replenishes urinary citrate inhibitor reserve and complexes ionized Ca2+ without hepatic CYP450 clearance.",
    };
  }

  // Pharmacological CYP2D6 / CYP2C9 substrates
  if (
    action.isPharmacological &&
    (action.primaryEnzyme === "CYP2D6" || action.primaryEnzyme === "CYP2C9")
  ) {
    const enzymePhenotype =
      action.primaryEnzyme === "CYP2D6"
        ? pharmacogenomics.cyp2d6Phenotype
        : pharmacogenomics.cyp2c9Phenotype;
    const pk = getPhenotypePkParams(enzymePhenotype, CYP_BASE_HALF_LIFE_H);

    const caution =
      enzymePhenotype === "poor" || enzymePhenotype === "ultra_rapid";
    return {
      actionId: action.id,
      basis: "phenotype_scaling",
      efficacyPct: Math.min(98, Math.max(68, 90 + pk.efficacyBonus)),
      recommendedDoseAdjustment: pk.doseNote,
      clearanceHalfLifeHours: pk.halfLifeHours,
      contraindicationSeverity: caution ? "caution" : "none",
      contraindicationWarning:
        enzymePhenotype === "poor"
          ? `${action.primaryEnzyme} Poor Metabolizer: extended t1/2 (${pk.halfLifeHours}h) increases hepatic accumulation risk.`
          : enzymePhenotype === "ultra_rapid"
          ? `${action.primaryEnzyme} Ultra-Rapid Metabolizer: sub-therapeutic trough possible without split dosing.`
          : undefined,
      mechanisticRationale: `Phenotype-scaled clearance estimate for ${action.primaryEnzyme} (${enzymePhenotype}) combined with SMO 016E baseline.`,
    };
  }

  // Hardware / environmental / behavioral protocols
  return {
    actionId: action.id,
    basis: "profile_rule",
    efficacyPct:
      action.id === "imm_storm_shelter" &&
      endurance.radiationToleranceMsvDay < 1.6
        ? 97
        : 94,
    recommendedDoseAdjustment:
      action.systemId === "immune_hematology" &&
      biochemical.baselineLymphocyteCount < 1600
        ? "Priority early execution (< 15 min from SPE alert)"
        : "Standard spacecraft hardware protocol",
    clearanceHalfLifeHours: 0,
    contraindicationSeverity: "none",
    mechanisticRationale:
      "Environmental / mechanical countermeasure independent of hepatic CYP450 clearance.",
  };
}

/**
 * Executes NASA JSC L-180/L-90 Pre-Flight Qualification Stress Suite to quantify
 * each astronaut's endurance envelope before launch. Each assay evaluates its own
 * independent biological criteria without cross-assay status leakage.
 */
export function runPreFlightQualificationSuite(
  profile: AstronautBiologicalProfile
): PreFlightQualificationTestResult[] {
  const mults = computeOrganSensitivityMultipliers(profile);
  const stoneRisk = assessRenalStoneRisk(profile);

  // 1. Hypercapnic CO2 Chamber (4.5 mmHg)
  const co2Score = Math.max(15, Math.round(104 - 46 * mults.neuro_ocular));
  const co2Status: PreFlightQualificationTestResult["status"] =
    co2Score < 55 ? "caution" : "pass";

  // 2. Acetazolamide 250 mg Renal Safety Trial
  const acetazolamideSpec = EXECUTABLE_COUNTERMEASURES.neuro_ocular.find(
    (a) => a.id === "neuro_acetazolamide_rx"
  )!;
  const acetazolamidePred = simulatePersonalizedDrugResponse(
    profile,
    acetazolamideSpec,
    {
      bloodPressureSystolic: 132,
      bloodPressureDiastolic: 86,
      heartRateBpm: 76,
      bloodGlucoseMgDl: 94,
      bodyTempC: 36.8,
      sleepHours: 7.0,
      moodScore: 7,
      hydrationMl: 2100,
      ocularFinding: "blurry_near",
      aredExerciseCompleted: true,
    },
    MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry
  );

  // 3. 0g Bone Unloading & Dehydration Tolerance (independent of Acetazolamide verdict)
  const boneScore = Math.max(
    15,
    Math.round(104 - 46 * mults.musculoskeletal_renal)
  );
  const boneStatus: PreFlightQualificationTestResult["status"] =
    stoneRisk.atRisk || boneScore < 55 ? "caution" : "pass";

  // 4. Solar Particle Event (3.2 mSv/day) Hematopoietic Tolerance
  const radScore = Math.max(15, Math.round(104 - 46 * mults.immune_hematology));
  const radStatus: PreFlightQualificationTestResult["status"] =
    radScore < 55 ? "caution" : "pass";

  return [
    {
      id: "qual_co2_chamber",
      title: "Hypercapnic CO2 Chamber (4.5 mmHg)",
      chamberOrAssay: "JSC Env Chamber + TCD Ultrasound",
      targetSystem: "neuro_ocular",
      status: co2Status,
      predictedScore: co2Score,
      enduranceLimitLabel: `${profile.endurance.co2ReactivitySlope.toFixed(2)}x slope · ONSD ${profile.endurance.baselineOnsdMm} mm`,
      clinicalSummary:
        profile.pharmacogenomics.mtrrGenotype === "GG_sans_risk"
          ? `MTRR 66GG risk allele drives rapid hypercapnic ONSD distension (${mults.neuro_ocular.toFixed(2)}x strain).`
          : `Stable cerebrovascular CO2 tolerance (${mults.neuro_ocular.toFixed(2)}x sensitivity).`,
      recommendedInFlightCountermeasure:
        "LBNP Venous Thigh Cuffs + CDRA High-Flow Override (CMO-SANS-01)",
    },
    {
      id: "qual_acetazolamide_pk",
      title: "Acetazolamide 250 mg In-Silico Trial",
      chamberOrAssay: "SMO 016E Renal Supersaturation Model",
      targetSystem: "musculoskeletal_renal",
      status:
        acetazolamidePred.contraindicationSeverity === "contraindicated"
          ? "contraindicated"
          : acetazolamidePred.contraindicationSeverity === "caution"
          ? "caution"
          : "pass",
      predictedScore: acetazolamidePred.efficacyPct,
      enduranceLimitLabel: `Urinary Ca2+ ${profile.biochemical.urinaryCalciumMgDay} mg/d · Citrate ${profile.biochemical.urinaryCitrateMgDay} mg/d`,
      clinicalSummary:
        acetazolamidePred.contraindicationWarning ??
        acetazolamidePred.mechanisticRationale,
      recommendedInFlightCountermeasure:
        acetazolamidePred.recommendedDoseAdjustment,
    },
    {
      id: "qual_bone_renal",
      title: "0g Bone Resorption & Renal Stone Load",
      chamberOrAssay: "DEXA BMD + 24h Urinary Citrate/CTX",
      targetSystem: "musculoskeletal_renal",
      status: boneStatus,
      predictedScore: boneScore,
      enduranceLimitLabel: `DEXA ${profile.endurance.dexaBoneTScore.toFixed(1)} · CTX ${profile.biochemical.serumCtxPgMl} pg/mL`,
      clinicalSummary: stoneRisk.atRisk
        ? `Renal stone susceptibility (${stoneRisk.factors.join(", ")}) demands >= 2,600 mL/day hydration + Potassium Citrate.`
        : `Low baseline Ca2+ excretion preserves wide renal stone margin.`,
      recommendedInFlightCountermeasure:
        "Potassium Citrate 20 mEq + Daily ARED Axial Loading",
    },
    {
      id: "qual_spe_marrow",
      title: "X-Flare SPE (3.2 mSv/d) Marrow Assay",
      chamberOrAssay: "SOMA ATM Repair & ALC Reserve",
      targetSystem: "immune_hematology",
      status: radStatus,
      predictedScore: radScore,
      enduranceLimitLabel: `ALC ${profile.biochemical.baselineLymphocyteCount} /uL · ATM ${profile.pharmacogenomics.atmDnaRepairScore.toFixed(2)}`,
      clinicalSummary:
        profile.pharmacogenomics.atmDnaRepairScore < 0.8
          ? `Reduced ATM DNA double-strand repair (${profile.pharmacogenomics.atmDnaRepairScore.toFixed(2)}) & low ALC mandate immediate storm shelter transit.`
          : `Strong marrow DNA repair capacity (${profile.pharmacogenomics.atmDnaRepairScore.toFixed(2)}).`,
      recommendedInFlightCountermeasure:
        "Water-Wall Storm Shelter within 15 min + Antioxidants",
    },
  ];
}

export type ConsultationSource = "deterministic" | "llm" | "fallback";

export interface TwinConsultationResult {
  engineUsed: string;
  source: ConsultationSource;
  fallbackReason?: string;
  deterministicGuardrail: string;
  summaryText: string;
  multipliers: OrganSensitivityMultipliers;
}

function buildDeterministicConsultation(
  profile: AstronautBiologicalProfile,
  evaluation: HealthEvaluationResult,
  multipliers: OrganSensitivityMultipliers,
  engineUsed: string
): string {
  const quals = runPreFlightQualificationSuite(profile);
  const topRisks = (Object.entries(multipliers) as Array<[BodySystemId, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([sys, val]) => `${sys} (${val.toFixed(2)}x)`)
    .join(", ");

  const contraindicated = quals.filter((q) => q.status === "contraindicated");
  const caution = quals.filter((q) => q.status === "caution");
  const pharmaNote =
    contraindicated.length > 0
      ? `CRITICAL GUARDRAIL: ${contraindicated[0].title} -> CONTRAINDICATED. ${contraindicated[0].clinicalSummary}`
      : caution.length > 0
      ? `CAUTION GUARDRAIL: ${caution.map((q) => q.title).join("; ")}. CYP2D6=${profile.pharmacogenomics.cyp2d6Phenotype}, CYP2C9=${profile.pharmacogenomics.cyp2c9Phenotype}, MTRR=${profile.pharmacogenomics.mtrrGenotype}.`
      : `PHARMACOGENOMICS: CYP2D6=${profile.pharmacogenomics.cyp2d6Phenotype}, CYP2C9=${profile.pharmacogenomics.cyp2c9Phenotype}, MTRR=${profile.pharmacogenomics.mtrrGenotype}.`;

  const lowestQual = [...quals].sort(
    (a, b) => a.predictedScore - b.predictedScore
  )[0];

  return [
    `[${engineUsed}] Calibrated BioTwin Profile for ${profile.name} (${profile.callsign})`,
    `Top Organ Vulnerabilities: ${topRisks} | Active Mission Readiness: ${evaluation.readinessScore}/100 (${evaluation.overallStatus.toUpperCase()})`,
    pharmaNote,
    `Autonomous Guidance: Prioritize ${lowestQual.recommendedInFlightCountermeasure}.`,
  ].join("\n\n");
}

async function probeLocalEndpoint(
  endpointUrl: string
): Promise<{ reachable: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    return {
      reachable: false,
      reason: "Invalid local LLM URL (must be http:// or https://).",
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      reachable: false,
      reason: "Unsupported URL scheme for local LLM endpoint.",
    };
  }

  // Probe Ollama /api/tags fast; non-Ollama servers (e.g. LM Studio :1234) return 404 on /api/tags and still pass.
  const probeUrl = `${parsed.origin}/api/tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_PROBE_TIMEOUT_MS);
  try {
    await fetch(probeUrl, { method: "GET", signal: controller.signal });
    return { reachable: true };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      reachable: false,
      reason: isAbort
        ? `Local LLM endpoint timed out (${OLLAMA_PROBE_TIMEOUT_MS}ms probe on ${parsed.origin}).`
        : `Local LLM unreachable or blocked by browser CORS at ${parsed.origin} (for Ollama, launch with OLLAMA_ORIGINS="*").`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generates an autonomous clinical synthesis using either:
 * 1) Local Mechanistic Blackout Engine (100% offline deterministic rule engine)
 * 2) Local On-Device LLM (Ollama / LM Studio localhost endpoint with 30s timeout)
 * 3) Open API (/api/twin-simulate or user-supplied OpenAI-compatible API endpoint)
 *
 * Always computes and attaches `deterministicGuardrail` so advisory LLM text can
 * never silently override deterministic pharmacogenomic contraindications.
 */
export async function generateTwinConsultationSummary(
  profile: AstronautBiologicalProfile,
  evaluation: HealthEvaluationResult,
  config: TwinInferenceConfig
): Promise<TwinConsultationResult> {
  const multipliers = computeOrganSensitivityMultipliers(profile);
  const quals = runPreFlightQualificationSuite(profile);
  const deterministicGuardrail = buildDeterministicConsultation(
    profile,
    evaluation,
    multipliers,
    "DETERMINISTIC CLINICAL GUARDRAILS"
  );

  if (config.mode === "local_mechanistic") {
    return {
      engineUsed: "LOCAL BLACKOUT RULE ENGINE (OFFLINE)",
      source: "deterministic",
      deterministicGuardrail,
      summaryText: buildDeterministicConsultation(
        profile,
        evaluation,
        multipliers,
        "LOCAL BLACKOUT ENGINE"
      ),
      multipliers,
    };
  }

  const qualVerdicts = quals
    .map((q) => `${q.title}: ${q.status.toUpperCase()} (${q.predictedScore}/100)`)
    .join("; ");

  const prompt = `Summarize pre-flight BioTwin risks and countermeasure guardrails in 4 concise bullet points for astronaut ${profile.name} (${profile.callsign}). Do not contradict any CONTRAINDICATED verdicts listed below:
Biochemistry: Urinary Ca2+ ${profile.biochemical.urinaryCalciumMgDay} mg/d, Citrate ${profile.biochemical.urinaryCitrateMgDay} mg/d, CTX ${profile.biochemical.serumCtxPgMl} pg/mL, ALC ${profile.biochemical.baselineLymphocyteCount}/uL.
Genomics: MTRR=${profile.pharmacogenomics.mtrrGenotype}, CYP2D6=${profile.pharmacogenomics.cyp2d6Phenotype}, CYP2C9=${profile.pharmacogenomics.cyp2c9Phenotype}, ATM=${profile.pharmacogenomics.atmDnaRepairScore}.
Endurance: CO2 slope ${profile.endurance.co2ReactivitySlope}x, ONSD ${profile.endurance.baselineOnsdMm}mm, DEXA T-score ${profile.endurance.dexaBoneTScore}, Rad tolerance ${profile.endurance.radiationToleranceMsvDay} mSv/d.
Sensitivity multipliers: ${JSON.stringify(multipliers)}. Readiness: ${evaluation.readinessScore}/100.
Deterministic Qualification Verdicts (authoritative): ${qualVerdicts}.`;

  if (config.mode === "local_ollama_llm") {
    const probe = await probeLocalEndpoint(config.localEndpointUrl);
    if (!probe.reachable) {
      return {
        engineUsed: "LOCAL LLM UNREACHABLE -> BLACKOUT FALLBACK",
        source: "fallback",
        fallbackReason: probe.reason,
        deterministicGuardrail,
        summaryText: buildDeterministicConsultation(
          profile,
          evaluation,
          multipliers,
          "OFFLINE FALLBACK ENGINE"
        ),
        multipliers,
      };
    }

    let fallbackReason = "Local LLM returned an empty response.";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOCAL_LLM_TIMEOUT_MS);
    try {
      const res = await fetch(config.localEndpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.localModelName || "llama3.2",
          messages: [
            {
              role: "system",
              content:
                "You are an advisory aerospace clinical decision model running offline during a Mars communications blackout. Always respect the authoritative contraindications given in the prompt.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 260,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          return {
            engineUsed: `LOCAL LLM (${config.localModelName || "ollama"})`,
            source: "llm",
            deterministicGuardrail,
            summaryText: content,
            multipliers,
          };
        }
      } else {
        fallbackReason = `Local LLM returned HTTP ${res.status} (${res.statusText || "error"}).`;
      }
    } catch (err) {
      fallbackReason =
        err instanceof Error && err.name === "AbortError"
          ? `Local LLM request timed out after ${LOCAL_LLM_TIMEOUT_MS / 1000}s.`
          : "Local LLM connection failed during inference.";
    } finally {
      clearTimeout(timeout);
    }

    return {
      engineUsed: "LOCAL LLM FAILED -> BLACKOUT FALLBACK",
      source: "fallback",
      fallbackReason,
      deterministicGuardrail,
      summaryText: buildDeterministicConsultation(
        profile,
        evaluation,
        multipliers,
        "OFFLINE FALLBACK ENGINE"
      ),
      multipliers,
    };
  }

  // Open API mode (built-in /api/twin-simulate OR direct browser call to external BYO OpenAI-compatible URL)
  const targetUrl = config.openApiEndpointUrl?.trim() || "/api/twin-simulate";
  const isBuiltIn = targetUrl.startsWith("/api/twin-simulate");
  let openApiFallbackReason = "Open API endpoint unreachable.";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_API_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!isBuiltIn && config.openApiKey.trim()) {
      headers.Authorization = `Bearer ${config.openApiKey.trim()}`;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(
        isBuiltIn
          ? {
              profile,
              envId: profile.missionAssignment,
            }
          : {
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "You are an advisory aerospace precision medicine assistant. Never override the authoritative contraindications in the prompt.",
                },
                { role: "user", content: prompt },
              ],
              temperature: 0.2,
              max_tokens: 260,
            }
      ),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        summary?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text =
        data?.summary ??
        data?.choices?.[0]?.message?.content?.trim() ??
        null;
      if (text) {
        return {
          engineUsed: isBuiltIn
            ? "OPEN REST API (/api/twin-simulate)"
            : `BYO OPEN API (${targetUrl})`,
          source: isBuiltIn ? "deterministic" : "llm",
          deterministicGuardrail,
          summaryText: text,
          multipliers,
        };
      }
      openApiFallbackReason = "Endpoint returned 200 OK without summary text.";
    } else {
      openApiFallbackReason = `Endpoint returned HTTP ${res.status}.`;
    }
  } catch (err) {
    openApiFallbackReason =
      err instanceof Error && err.name === "AbortError"
        ? `Open API request timed out after ${OPEN_API_TIMEOUT_MS / 1000}s.`
        : "Open API request failed (network or CORS error).";
  } finally {
    clearTimeout(timeout);
  }

  return {
    engineUsed: "OPEN API FALLBACK -> LOCAL ENGINE",
    source: "fallback",
    fallbackReason: openApiFallbackReason,
    deterministicGuardrail,
    summaryText: buildDeterministicConsultation(
      profile,
      evaluation,
      multipliers,
      "OPEN API FALLBACK ENGINE"
    ),
    multipliers,
  };
}

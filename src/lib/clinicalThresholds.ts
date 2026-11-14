import type {
  AstronautBiologicalProfile,
  CypMetabolizerPhenotype,
  MtrrGenotype,
} from "@/types/health";

/**
 * Single source of truth for spaceflight calcium-phosphate / calcium-oxalate
 * renal stone risk thresholds (NASA SMO 016E / HRP Renal Stone Risk).
 */
export const RENAL_STONE = {
  caHigh: 250, // > 250 mg/day urinary calcium (hypercalciuria)
  citrateLow: 260, // < 260 mg/day urinary citrate (hypocitraturia)
  dexaLow: -1.0, // <= -1.0 SD femoral/spine T-score (osteopenic unloading)
} as const;

export type RenalStoneRiskFactor =
  | "hypercalciuria"
  | "hypocitraturia"
  | "osteopenia";

export interface RenalStoneRisk {
  atRisk: boolean;
  factors: RenalStoneRiskFactor[];
}

export function assessRenalStoneRisk(
  profile: AstronautBiologicalProfile
): RenalStoneRisk {
  const factors: RenalStoneRiskFactor[] = [];
  if (profile.biochemical.urinaryCalciumMgDay > RENAL_STONE.caHigh) {
    factors.push("hypercalciuria");
  }
  if (profile.biochemical.urinaryCitrateMgDay < RENAL_STONE.citrateLow) {
    factors.push("hypocitraturia");
  }
  if (profile.endurance.dexaBoneTScore <= RENAL_STONE.dexaLow) {
    factors.push("osteopenia");
  }
  return {
    atRisk: factors.length > 0,
    factors,
  };
}

/**
 * Neutral population-reference baseline used for any biological field omitted
 * in an uploaded dossier. Never defaults to a high-risk astronaut persona.
 */
export const REFERENCE_BASELINE = {
  biochemical: {
    urinaryCalciumMgDay: 180,
    urinaryCitrateMgDay: 380,
    serumCtxPgMl: 320,
    baselineLymphocyteCount: 2100,
    serumFerritinNgMl: 110,
    baselineNflPgMl: 9.5,
  },
  pharmacogenomics: {
    mtrrGenotype: "AA_normal" as MtrrGenotype,
    cyp2d6Phenotype: "normal" as CypMetabolizerPhenotype,
    cyp2c9Phenotype: "normal" as CypMetabolizerPhenotype,
    atmDnaRepairScore: 1.0,
  },
  endurance: {
    co2ReactivitySlope: 1.0,
    baselineOnsdMm: 4.6,
    dexaBoneTScore: 0.0,
    lbnpEnduranceMin: 32,
    radiationToleranceMsvDay: 2.0,
  },
} as const;

export const ALL_BIOLOGICAL_FIELDS = [
  "urinaryCalciumMgDay",
  "urinaryCitrateMgDay",
  "serumCtxPgMl",
  "baselineLymphocyteCount",
  "serumFerritinNgMl",
  "baselineNflPgMl",
  "mtrrGenotype",
  "cyp2d6Phenotype",
  "cyp2c9Phenotype",
  "atmDnaRepairScore",
  "co2ReactivitySlope",
  "baselineOnsdMm",
  "dexaBoneTScore",
  "lbnpEnduranceMin",
  "radiationToleranceMsvDay",
] as const;

export type BiologicalFieldKey = (typeof ALL_BIOLOGICAL_FIELDS)[number];

export const ARES_TWIN_PROTOCOL =
  "ARES-TWIN/1.0 (NASA SSM · SMO 016E · SOMA-informed)";

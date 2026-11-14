import { describe, expect, it } from "vitest";
import { DEFAULT_CREW_PROFILES } from "@/data/nasaHrpData";
import {
  ALL_BIOLOGICAL_FIELDS,
  REFERENCE_BASELINE,
  RENAL_STONE,
  assessRenalStoneRisk,
} from "@/lib/clinicalThresholds";
import type { AstronautBiologicalProfile } from "@/types/health";

describe("clinicalThresholds & assessRenalStoneRisk", () => {
  const vance = DEFAULT_CREW_PROFILES.find((p) => p.id === "ares_1_vance")!;
  const chen = DEFAULT_CREW_PROFILES.find((p) => p.id === "ares_2_chen")!;
  const korolev = DEFAULT_CREW_PROFILES.find((p) => p.id === "ares_3_korolev")!;

  function makeBaselineProfile(
    overrides?: Partial<{
      ca: number;
      citrate: number;
      dexa: number;
    }>
  ): AstronautBiologicalProfile {
    return {
      ...vance,
      id: "threshold_test",
      biochemical: {
        ...REFERENCE_BASELINE.biochemical,
        urinaryCalciumMgDay:
          overrides?.ca ?? REFERENCE_BASELINE.biochemical.urinaryCalciumMgDay,
        urinaryCitrateMgDay:
          overrides?.citrate ??
          REFERENCE_BASELINE.biochemical.urinaryCitrateMgDay,
      },
      pharmacogenomics: { ...REFERENCE_BASELINE.pharmacogenomics },
      endurance: {
        ...REFERENCE_BASELINE.endurance,
        dexaBoneTScore:
          overrides?.dexa ?? REFERENCE_BASELINE.endurance.dexaBoneTScore,
      },
    };
  }

  it("identifies hypercalciuria, hypocitraturia, and osteopenia on Chen while sparing Vance and Korolev", () => {
    const chenRisk = assessRenalStoneRisk(chen);
    expect(chenRisk.atRisk).toBe(true);
    expect(chenRisk.factors).toEqual([
      "hypercalciuria",
      "hypocitraturia",
      "osteopenia",
    ]);

    expect(assessRenalStoneRisk(vance)).toEqual({
      atRisk: false,
      factors: [],
    });
    expect(assessRenalStoneRisk(korolev)).toEqual({
      atRisk: false,
      factors: [],
    });
  });

  it("enforces exact single-source-of-truth boundary thresholds", () => {
    // Urinary Calcium boundary: > 250
    expect(
      assessRenalStoneRisk(makeBaselineProfile({ ca: RENAL_STONE.caHigh }))
        .atRisk
    ).toBe(false);
    expect(
      assessRenalStoneRisk(makeBaselineProfile({ ca: RENAL_STONE.caHigh + 1 }))
    ).toEqual({
      atRisk: true,
      factors: ["hypercalciuria"],
    });

    // Urinary Citrate boundary: < 260
    expect(
      assessRenalStoneRisk(
        makeBaselineProfile({ citrate: RENAL_STONE.citrateLow })
      ).atRisk
    ).toBe(false);
    expect(
      assessRenalStoneRisk(
        makeBaselineProfile({ citrate: RENAL_STONE.citrateLow - 1 })
      )
    ).toEqual({
      atRisk: true,
      factors: ["hypocitraturia"],
    });

    // DEXA Bone T-score boundary: <= -1.0
    expect(
      assessRenalStoneRisk(makeBaselineProfile({ dexa: -0.9 })).atRisk
    ).toBe(false);
    expect(
      assessRenalStoneRisk(makeBaselineProfile({ dexa: RENAL_STONE.dexaLow }))
    ).toEqual({
      atRisk: true,
      factors: ["osteopenia"],
    });
  });

  it("tracks all 15 biological profile fields cleanly", () => {
    expect(ALL_BIOLOGICAL_FIELDS).toHaveLength(15);
    expect(REFERENCE_BASELINE.pharmacogenomics.mtrrGenotype).toBe("AA_normal");
  });
});

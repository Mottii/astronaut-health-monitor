import { describe, expect, it } from "vitest";
import {
  BASE_14_SOL_HISTORY,
  BODY_SYSTEM_METADATA,
  DEFAULT_ROUTINE_TASKS,
  DEMO_SCENARIOS,
  EARTH_VS_SPACE_RANGES,
  MISSION_ENVIRONMENTS,
  NASA_HAZARDS,
} from "@/data/nasaHrpData";
import type { BodySystemId, MissionEnvironmentId } from "@/types/health";

describe("nasaHrpData reference dataset", () => {
  it("defines all 5 NASA HRP hazards and 4 mission environments", () => {
    expect(Object.keys(NASA_HAZARDS)).toHaveLength(5);
    const envIds: MissionEnvironmentId[] = [
      "iss_orbit",
      "lunar_rover",
      "mars_transit",
      "mars_base",
    ];
    expect(Object.keys(MISSION_ENVIRONMENTS).sort()).toEqual(envIds.sort());
    for (const id of envIds) {
      expect(BASE_14_SOL_HISTORY[id].length).toBeGreaterThanOrEqual(13);
    }
  });

  it("defines all 6 body systems with OSDR citations and 3+ self-exam steps", () => {
    const systemIds: BodySystemId[] = [
      "neuro_ocular",
      "cardiovascular",
      "musculoskeletal_renal",
      "metabolic_endocrine",
      "immune_hematology",
      "behavioral_circadian",
    ];
    expect(Object.keys(BODY_SYSTEM_METADATA).sort()).toEqual(systemIds.sort());
    for (const id of systemIds) {
      const sys = BODY_SYSTEM_METADATA[id];
      expect(sys.osdrStudyIds.length).toBeGreaterThanOrEqual(1);
      expect(sys.selfExamSteps.length).toBeGreaterThanOrEqual(3);
      expect(sys.countermeasures.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("includes 4 judge demo scenarios, Earth-vs-Space ranges, and routine tasks", () => {
    expect(DEMO_SCENARIOS).toHaveLength(4);
    expect(EARTH_VS_SPACE_RANGES.length).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_ROUTINE_TASKS.length).toBeGreaterThanOrEqual(5);
  });
});

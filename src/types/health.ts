/**
 * Core domain types for ARES-MED OS — BioTwin Cascade & Autonomous CMO Console.
 * Grounded in NASA Human Research Program (HRP), OSDR EDA/RadLab, and CSA frameworks.
 */

export type MissionEnvironmentId =
  | "iss_orbit"
  | "lunar_rover"
  | "mars_transit"
  | "mars_base";

export type BodySystemId =
  | "neuro_ocular"
  | "cardiovascular"
  | "musculoskeletal_renal"
  | "metabolic_endocrine"
  | "immune_hematology"
  | "behavioral_circadian";

export type HazardId =
  | "radiation"
  | "isolation"
  | "distance"
  | "gravity"
  | "closed_env";

export type TriageStatus = "green" | "amber" | "red";

export type OcularFinding = "clear" | "blurry_near" | "visual_halos";

export type SolarFlareClass = "None" | "C" | "M" | "X";

export interface VitalReadings {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRateBpm: number;
  bloodGlucoseMgDl: number;
  bodyTempC: number;
  sleepHours: number;
  moodScore: number;
  hydrationMl: number;
  ocularFinding: OcularFinding;
  aredExerciseCompleted: boolean;
}

export interface EnvironmentTelemetry {
  cabinCo2MmHg: number;
  cabinTempC: number;
  cabinHumidityPct: number;
  dailyRadiationMsv: number;
  gcrDoseMsv: number;
  saaOrSpeDoseMsv: number;
  solarFlareClass: SolarFlareClass;
}

export interface NasaHazardInfo {
  id: HazardId;
  name: string;
  shortLabel: string;
  description: string;
  referenceUrl: string;
}

export interface EarthVsSpaceRange {
  metricKey: keyof VitalReadings | keyof EnvironmentTelemetry;
  label: string;
  unit: string;
  earthNormal: string;
  spaceflightAdjusted: string;
  rationale: string;
}

export interface SelfExamStep {
  stepNumber: number;
  title: string;
  instruction: string;
  normalObservation: string;
  escalationTrigger: string;
}

export interface BodySystemMetadata {
  id: BodySystemId;
  name: string;
  shortLabel: string;
  organSummary: string;
  nasaHrpRiskTitle: string;
  nasaHrpUrl: string;
  osdrStudyIds: string[];
  partnerReference?: string;
  whyExamNeededInSpace: string;
  primaryHazards: HazardId[];
  selfExamSteps: SelfExamStep[];
  countermeasures: string[];
  flightSurgeonCriteria: string;
  svgCoords: {
    cx: number;
    cy: number;
  };
}

export interface MissionEnvironmentConfig {
  id: MissionEnvironmentId;
  name: string;
  subtitle: string;
  gravityG: number;
  gravityLabel: string;
  commDelayLabel: string;
  commDelaySeconds: number;
  autonomousModeRequired: boolean;
  activeHazards: HazardId[];
  hazardWeights: Record<HazardId, number>;
  defaultTelemetry: EnvironmentTelemetry;
}

export type CascadeId =
  | "gravity_fluid_sans"
  | "bone_calcium_renal"
  | "radiation_sleep_immune"
  | "stress_glucose_metabolic";

export interface CascadeLink {
  id: CascadeId;
  title: string;
  fromSystem: BodySystemId;
  toSystem: BodySystemId;
  severity: "amber" | "red";
  mechanism: string;
  triggeredByHazard: HazardId;
  immediateAction: string;
}

export interface SystemAssessment {
  systemId: BodySystemId;
  status: TriageStatus;
  score: number;
  headline: string;
  findings: string[];
  earthVsSpaceNote: string;
  recommendedActions: string[];
}

export interface HealthEvaluationResult {
  readinessScore: number;
  overallStatus: TriageStatus;
  autonomousTriageRequired: boolean;
  flightSurgeonAlertRequired: boolean;
  clampedVitals: VitalReadings;
  systems: Record<BodySystemId, SystemAssessment>;
  activeCascades: CascadeLink[];
}

export interface SolTelemetryPoint {
  sol: string;
  heartRateBpm: number;
  systolicBp: number;
  bloodGlucoseMgDl: number;
  sleepHours: number;
  moodScore: number;
  issCabinCo2MmHg: number;
  groundControlCo2MmHg: number;
  gcrDoseMsv: number;
  saaDoseMsv: number;
  totalRadiationMsv: number;
}

export type ScenarioId =
  | "nominal"
  | "solar_storm"
  | "sans_co2_fluid_shift"
  | "renal_dehydration";

export interface MissionScenario {
  id: ScenarioId;
  name: string;
  badge: string;
  description: string;
  environmentId: MissionEnvironmentId;
  vitals: VitalReadings;
  envTelemetry: EnvironmentTelemetry;
  focusSystem: BodySystemId;
}

export interface RoutineTask {
  id: string;
  title: string;
  category: BodySystemId;
  xp: number;
  durationMin: number;
  nasaProtocolNote: string;
}

export interface RoutineProgressState {
  completedTaskIds: string[];
  xp: number;
  streakSols: number;
  lastUpdatedIso: string;
}

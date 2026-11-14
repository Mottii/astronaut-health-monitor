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
  | "stress_glucose_metabolic"
  | "drug_acetazolamide_renal";

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

export type CmoWorkflowStage = "overview" | "exam" | "intervene" | "downlink";

export interface SelectedSubStructure {
  systemId: BodySystemId;
  nodeName: string;
  displayLabel: string;
  layer: string;
  tissueTag: string;
}

export interface ExamStepFinding {
  status: "pending" | "normal" | "escalated";
  note?: string;
  measuredValue?: string;
  updatedAt?: string;
}

export interface CountermeasureActionSpec {
  id: string;
  systemId: BodySystemId;
  label: string;
  protocolCode: string;
  hardwareTarget: string;
  deltaSummary: string;
  vitalsPatch?: Partial<VitalReadings>;
  envPatch?: Partial<EnvironmentTelemetry>;
  routineTaskId?: string;
  isPharmacological?: boolean;
  primaryEnzyme?: "CYP2D6" | "CYP2C9" | "CA2_RENAL" | "GCSF_MARROW";
}

export interface ExecutedActionLog {
  id: string;
  actionId: string;
  systemId: BodySystemId;
  label: string;
  deltaSummary: string;
  timestamp: string;
}

export type TelemetryMode = "preset" | "live_hardware" | "hybrid_overlay";

export type BiometricSourceType =
  | "astroskin_stream"
  | "web_bluetooth"
  | "webcam_rppg"
  | "external_api";

export interface IssEthosSymbolReading {
  symbol: string;
  subsystem: "ETHOS_USLAB" | "ECLSS_NODE3" | "RADLAB_HERA";
  label: string;
  value: number | string;
  unit: string;
  nominalRange: string;
}

export interface IssLiveTelemetrySnapshot {
  timestampUtc: string;
  source: "iss_live_stream" | "iss_telemetry_fallback";
  orbital: {
    latitude: number;
    longitude: number;
    altitudeKm: number;
    velocityKmh: number;
    visibility: string;
    inSouthAtlanticAnomaly: boolean;
  };
  symbols: Record<string, IssEthosSymbolReading>;
  mappedEnvTelemetry: EnvironmentTelemetry;
}

export interface OsdrStudyLiveMetadata {
  studyId: string;
  title: string;
  missionName: string;
  organismOrSubject: string;
  assayTypes: string[];
  sampleCount: number;
  source: "nasa_osdr_live" | "curated_osdr_cache";
  osdrUrl: string;
}

export interface NasaHardwareSpec {
  id: string;
  name: string;
  agency: "NASA" | "CSA" | "NASA / CSA";
  program: string;
  telemetrySymbolOrProtocol: string;
  mappedMetrics: string[];
  clinicalRole: string;
  referenceUrl: string;
}

export type MtrrGenotype = "AA_normal" | "AG_heterozygous" | "GG_sans_risk";
export type CypMetabolizerPhenotype = "ultra_rapid" | "normal" | "intermediate" | "poor";
export type TwinInferenceMode = "local_mechanistic" | "local_ollama_llm" | "open_api";

export interface PreFlightBiochemicalPanel {
  urinaryCalciumMgDay: number;       // Earth normal: 100-220 mg/day; >250 hypercalciuria
  urinaryCitrateMgDay: number;       // Stone inhibitor: >320 mg/day normal; <260 low
  serumCtxPgMl: number;              // Bone resorption marker: 200-450 pg/mL normal
  baselineLymphocyteCount: number;   // ALC cells/uL: 1500-3500 normal
  serumFerritinNgMl: number;         // Iron stores: 40-200 ng/mL normal
  baselineNflPgMl: number;           // Neurofilament light chain: 5-14 pg/mL normal
}

export interface PharmacogenomicProfile {
  mtrrGenotype: MtrrGenotype;        // MTRR A66G one-carbon folate SNP (SANS risk)
  cyp2d6Phenotype: CypMetabolizerPhenotype;
  cyp2c9Phenotype: CypMetabolizerPhenotype;
  atmDnaRepairScore: number;         // 0.50 to 1.40 (1.0 = normal DNA repair capacity)
}

export interface PhysiologicalEnduranceEnvelope {
  co2ReactivitySlope: number;        // 0.60 to 2.00 (1.0 = nominal cerebral vasodilation per mmHg CO2)
  baselineOnsdMm: number;            // 4.1 to 5.4 mm pre-flight ocular ultrasound baseline
  dexaBoneTScore: number;            // -2.0 to +1.5 pre-flight spine/femur BMD T-score
  lbnpEnduranceMin: number;          // 15 to 45 min orthostatic chamber tolerance
  radiationToleranceMsvDay: number;  // 1.0 to 3.0 mSv/day acute hematopoietic threshold
}

export interface AstronautBiologicalProfile {
  id: string;
  callsign: string;
  name: string;
  role: string;
  missionAssignment: MissionEnvironmentId;
  summaryTag: string;
  biochemical: PreFlightBiochemicalPanel;
  pharmacogenomics: PharmacogenomicProfile;
  endurance: PhysiologicalEnduranceEnvelope;
}

export type OrganSensitivityMultipliers = Record<BodySystemId, number>;

export interface DrugSimulationPrediction {
  actionId: string;
  efficacyPct: number;
  recommendedDoseAdjustment: string;
  clearanceHalfLifeHours: number;
  contraindicationSeverity: "none" | "caution" | "contraindicated";
  contraindicationWarning?: string;
  secondarySystemImpact?: {
    systemId: BodySystemId;
    scoreDelta: number;
    vitalsPatch?: Partial<VitalReadings>;
    mechanism: string;
  };
  mechanisticRationale: string;
}

export interface PreFlightQualificationTestResult {
  id: string;
  title: string;
  chamberOrAssay: string;
  targetSystem: BodySystemId;
  status: "pass" | "caution" | "contraindicated";
  predictedScore: number;
  enduranceLimitLabel: string;
  clinicalSummary: string;
  recommendedInFlightCountermeasure: string;
}

export interface TwinInferenceConfig {
  mode: TwinInferenceMode;
  localEndpointUrl: string;
  localModelName: string;
  openApiEndpointUrl: string;
  openApiKey: string;
}

export interface FlightSurgeonPacketContext {
  examFindings?: Record<string, ExamStepFinding>;
  executedActions?: ExecutedActionLog[];
  subStructure?: SelectedSubStructure | null;
  telemetryMode?: TelemetryMode;
  biometricSource?: BiometricSourceType;
  issSnapshot?: IssLiveTelemetrySnapshot | null;
  crewProfile?: AstronautBiologicalProfile | null;
  inferenceMode?: TwinInferenceMode;
}

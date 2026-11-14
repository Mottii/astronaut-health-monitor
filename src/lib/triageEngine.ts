import { BODY_SYSTEM_METADATA, MISSION_ENVIRONMENTS } from "@/data/nasaHrpData";
import type {
  BodySystemId,
  CascadeLink,
  CountermeasureActionSpec,
  EnvironmentTelemetry,
  FlightSurgeonPacketContext,
  HealthEvaluationResult,
  MissionEnvironmentConfig,
  MissionEnvironmentId,
  SystemAssessment,
  TriageStatus,
  VitalReadings,
} from "@/types/health";

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function maxStatus(a: TriageStatus, b: TriageStatus): TriageStatus {
  const rank: Record<TriageStatus, number> = { green: 0, amber: 1, red: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Sanitizes and clamps incoming astronaut vitals within safe physiological engine bounds.
 */
export function clampVitalReadings(vitals: VitalReadings): VitalReadings {
  const systolic = clampNumber(vitals.bloodPressureSystolic, 60, 220, 118);
  const diastolic = clampNumber(
    vitals.bloodPressureDiastolic,
    40,
    140,
    76
  );

  return {
    bloodPressureSystolic: systolic,
    bloodPressureDiastolic: Math.min(diastolic, systolic - 10),
    heartRateBpm: Math.round(clampNumber(vitals.heartRateBpm, 30, 200, 68)),
    bloodGlucoseMgDl: Math.round(
      clampNumber(vitals.bloodGlucoseMgDl, 40, 400, 92)
    ),
    bodyTempC: Number(clampNumber(vitals.bodyTempC, 34.0, 41.5, 36.8).toFixed(1)),
    sleepHours: Number(clampNumber(vitals.sleepHours, 0, 16, 7.2).toFixed(1)),
    moodScore: Math.round(clampNumber(vitals.moodScore, 1, 10, 8)),
    hydrationMl: Math.round(clampNumber(vitals.hydrationMl, 0, 6000, 2400)),
    ocularFinding:
      vitals.ocularFinding === "blurry_near" ||
      vitals.ocularFinding === "visual_halos"
        ? vitals.ocularFinding
        : "clear",
    aredExerciseCompleted: Boolean(vitals.aredExerciseCompleted),
  };
}

function clampEnvTelemetry(
  envTelemetry: EnvironmentTelemetry
): EnvironmentTelemetry {
  return {
    cabinCo2MmHg: Number(
      clampNumber(envTelemetry.cabinCo2MmHg, 0.2, 15.0, 2.8).toFixed(2)
    ),
    cabinTempC: Number(
      clampNumber(envTelemetry.cabinTempC, 10.0, 40.0, 22.0).toFixed(1)
    ),
    cabinHumidityPct: Math.round(
      clampNumber(envTelemetry.cabinHumidityPct, 10, 95, 45)
    ),
    dailyRadiationMsv: Number(
      clampNumber(envTelemetry.dailyRadiationMsv, 0, 25.0, 0.5).toFixed(2)
    ),
    gcrDoseMsv: Number(
      clampNumber(envTelemetry.gcrDoseMsv, 0, 15.0, 0.3).toFixed(2)
    ),
    saaOrSpeDoseMsv: Number(
      clampNumber(envTelemetry.saaOrSpeDoseMsv, 0, 20.0, 0.2).toFixed(2)
    ),
    solarFlareClass:
      envTelemetry.solarFlareClass === "C" ||
      envTelemetry.solarFlareClass === "M" ||
      envTelemetry.solarFlareClass === "X"
        ? envTelemetry.solarFlareClass
        : "None",
  };
}

function buildAssessment(
  systemId: BodySystemId,
  status: TriageStatus,
  score: number,
  headline: string,
  findings: string[],
  earthVsSpaceNote: string
): SystemAssessment {
  const meta = BODY_SYSTEM_METADATA[systemId];
  return {
    systemId,
    status,
    score: Math.round(clampNumber(score, 0, 100, 100)),
    headline,
    findings,
    earthVsSpaceNote,
    recommendedActions:
      status === "green"
        ? [meta.countermeasures[0]]
        : meta.countermeasures,
  };
}

function assessNeuroOcular(
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  env: MissionEnvironmentConfig
): SystemAssessment {
  let status: TriageStatus = "green";
  let score = 96;
  const findings: string[] = [];

  if (vitals.ocularFinding === "visual_halos") {
    status = "red";
    score -= 48;
    findings.push("Visual halos reported — acute optic nerve sheath strain risk.");
  } else if (vitals.ocularFinding === "blurry_near") {
    status = "amber";
    score -= 24;
    findings.push("Hyperopic near-vision blur reported (classic early SANS sign).");
  } else {
    findings.push("Amsler & near visual acuity nominal.");
  }

  if (envTelemetry.cabinCo2MmHg > 4.0) {
    status = maxStatus(status, "red");
    score -= 28;
    findings.push(
      `OSDR EDA cabin CO2 elevated (${envTelemetry.cabinCo2MmHg} mmHg > 4.0 threshold), amplifying cerebral vasodilation.`
    );
  } else if (envTelemetry.cabinCo2MmHg > 3.2) {
    status = maxStatus(status, "amber");
    score -= 12;
    findings.push(
      `Cabin CO2 moderately elevated (${envTelemetry.cabinCo2MmHg} mmHg vs. <= 3.0 target).`
    );
  }

  if (env.gravityG === 0 && vitals.bloodPressureSystolic >= 132) {
    status = maxStatus(status, "amber");
    score -= 14;
    findings.push(
      `0g cephalad fluid shift compounded by systolic BP ${vitals.bloodPressureSystolic} mmHg.`
    );
  }

  const headline =
    status === "red"
      ? "SANS / Intracranial Pressure Alert"
      : status === "amber"
      ? "Elevated Cephalad / CO2 Strain"
      : "Optic & Vestibular Function Nominal";

  return buildAssessment(
    "neuro_ocular",
    status,
    score,
    headline,
    findings,
    `Earth CO2 ~0.3 mmHg vs. ${env.name} current ${envTelemetry.cabinCo2MmHg} mmHg under ${env.gravityLabel}.`
  );
}

function assessCardiovascular(
  vitals: VitalReadings,
  env: MissionEnvironmentConfig
): SystemAssessment {
  let status: TriageStatus = "green";
  let score = 96;
  const findings: string[] = [];

  if (
    vitals.bloodPressureSystolic >= 140 ||
    vitals.bloodPressureDiastolic >= 90 ||
    vitals.bloodPressureSystolic < 90
  ) {
    status = "red";
    score -= 38;
    findings.push(
      `BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg outside spaceflight arterial band.`
    );
  } else if (
    vitals.bloodPressureSystolic >= 130 ||
    vitals.bloodPressureDiastolic >= 85
  ) {
    status = "amber";
    score -= 16;
    findings.push(
      `Borderline elevated BP (${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg) under ${env.gravityLabel}.`
    );
  } else {
    findings.push(
      `BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg within spaceflight-adjusted range (100–128 / 65–84).`
    );
  }

  if (vitals.heartRateBpm > 102 || vitals.heartRateBpm < 45) {
    status = maxStatus(status, "red");
    score -= 32;
    findings.push(`Resting HR ${vitals.heartRateBpm} bpm requires rhythm screen.`);
  } else if (vitals.heartRateBpm > 88 || vitals.heartRateBpm < 50) {
    status = maxStatus(status, "amber");
    score -= 12;
    findings.push(
      `Resting HR ${vitals.heartRateBpm} bpm shifted from 52–88 bpm microgravity vagal baseline.`
    );
  } else {
    findings.push(`Resting HR ${vitals.heartRateBpm} bpm nominal for ${env.gravityLabel}.`);
  }

  const headline =
    status === "red"
      ? "Cardiovascular Stress / Orthostatic Risk"
      : status === "amber"
      ? "Fluid-Shift Cardiovascular Adaptation"
      : "Cardiac & Baroreceptor Status Nominal";

  return buildAssessment(
    "cardiovascular",
    status,
    score,
    headline,
    findings,
    `Earth HR 60–100 bpm vs. space vagal baseline 52–88 bpm; 0g shifts ~2L fluid toward thorax/head.`
  );
}

function assessMusculoskeletalRenal(
  vitals: VitalReadings,
  env: MissionEnvironmentConfig
): SystemAssessment {
  let status: TriageStatus = "green";
  let score = 96;
  const findings: string[] = [];

  if (vitals.hydrationMl < 1500) {
    status = "red";
    score -= 45;
    findings.push(
      `Critical dehydration (${vitals.hydrationMl} mL/day < 1,500 mL) in altered gravity drives rapid renal calcium supersaturation.`
    );
  } else if (vitals.hydrationMl < 2100) {
    status = "amber";
    score -= 18;
    findings.push(
      `Suboptimal hydration (${vitals.hydrationMl} mL/day vs. >= 2,400 mL space renal target).`
    );
  } else {
    findings.push(
      `Hydration ${vitals.hydrationMl} mL/day adequately dilutes mobilized bone calcium.`
    );
  }

  if (!vitals.aredExerciseCompleted) {
    status = maxStatus(status, env.gravityG === 0 ? "amber" : "amber");
    score -= Math.round(16 * env.hazardWeights.gravity);
    findings.push(
      "Daily ARED axial bone-loading protocol not yet logged (accelerates ~1–1.5%/mo mineral loss)."
    );
  } else {
    findings.push("ARED resistive loading completed for current Sol.");
  }

  const headline =
    status === "red"
      ? "Acute Renal Stone & Bone Loss Risk"
      : status === "amber"
      ? "Bone Calcium / Hydration Caution"
      : "Bone Loading & Renal Clearance Nominal";

  return buildAssessment(
    "musculoskeletal_renal",
    status,
    score,
    headline,
    findings,
    `Earth hydration 2,000 mL vs. space renal target >= 2,400 mL due to ${env.gravityLabel} bone Ca2+ resorption (OSD-48 / OSD-37).`
  );
}

function assessMetabolicEndocrine(
  vitals: VitalReadings,
  env: MissionEnvironmentConfig
): SystemAssessment {
  let status: TriageStatus = "green";
  let score = 96;
  const findings: string[] = [];

  if (vitals.bloodGlucoseMgDl >= 140 || vitals.bloodGlucoseMgDl < 65) {
    status = "red";
    score -= 42;
    findings.push(
      `Blood glucose ${vitals.bloodGlucoseMgDl} mg/dL outside safe autonomous operational range (65–139 mg/dL).`
    );
  } else if (vitals.bloodGlucoseMgDl > 110 || vitals.bloodGlucoseMgDl < 75) {
    status = "amber";
    score -= 16;
    findings.push(
      `Blood glucose ${vitals.bloodGlucoseMgDl} mg/dL indicates subclinical spaceflight insulin shift (> 110 mg/dL).`
    );
  } else {
    findings.push(`Blood glucose ${vitals.bloodGlucoseMgDl} mg/dL within spaceflight fasting range.`);
  }

  if (vitals.bodyTempC >= 38.0 || vitals.bodyTempC < 35.5) {
    status = maxStatus(status, "red");
    score -= 34;
    findings.push(`Core body temp ${vitals.bodyTempC} °C flags febrile or thermal excursion.`);
  } else if (vitals.bodyTempC >= 37.6) {
    status = maxStatus(status, "amber");
    score -= 12;
    findings.push(
      `Mild core temp elevation (${vitals.bodyTempC} °C) consistent with 0g sweat-evaporation lag.`
    );
  } else {
    findings.push(`Core temp ${vitals.bodyTempC} °C within 36.3–37.5 °C spaceflight range.`);
  }

  const headline =
    status === "red"
      ? "Metabolic / Thermal Excursion Alert"
      : status === "amber"
      ? "Subclinical Insulin Resistance / Mild Temp Shift"
      : "Metabolic & Thermoregulatory Nominal";

  return buildAssessment(
    "metabolic_endocrine",
    status,
    score,
    headline,
    findings,
    `Earth fasting glucose 70–99 mg/dL vs. spaceflight adjusted 75–110 mg/dL under ${env.gravityLabel} (OSD-104).`
  );
}

function assessImmuneHematology(
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  env: MissionEnvironmentConfig
): SystemAssessment {
  let status: TriageStatus = "green";
  let score = 96;
  const findings: string[] = [];

  const weightedRadiation =
    envTelemetry.dailyRadiationMsv * env.hazardWeights.radiation;

  if (
    envTelemetry.solarFlareClass === "X" ||
    envTelemetry.dailyRadiationMsv >= 2.5
  ) {
    status = "red";
    score -= 48;
    findings.push(
      `High radiation exposure (${envTelemetry.dailyRadiationMsv} mSv/day, Solar Flare: ${envTelemetry.solarFlareClass}) exceeds storm-shelter action threshold.`
    );
  } else if (
    envTelemetry.solarFlareClass === "M" ||
    weightedRadiation >= 1.5 ||
    envTelemetry.dailyRadiationMsv > 1.2
  ) {
    status = "amber";
    score -= Math.round(16 * env.hazardWeights.radiation);
    findings.push(
      `Elevated BLEO/RadLab radiation load (${envTelemetry.dailyRadiationMsv} mSv/day; Flare: ${envTelemetry.solarFlareClass}).`
    );
  } else {
    findings.push(
      `RadLab radiation dose (${envTelemetry.dailyRadiationMsv} mSv/day) nominal for ${env.name}.`
    );
  }

  if (vitals.bodyTempC >= 37.8) {
    status = maxStatus(status, "amber");
    score -= 14;
    findings.push(
      `Core temp ${vitals.bodyTempC} °C warrants viral-reactivation / infection screening.`
    );
  }

  const headline =
    status === "red"
      ? "Solar Particle / Immune Suppression Alert"
      : status === "amber"
      ? "Elevated Radiation & Immune Load"
      : "Immune & Hematologic Profile Nominal";

  return buildAssessment(
    "immune_hematology",
    status,
    score,
    headline,
    findings,
    `Earth sea-level 0.008 mSv/day vs. ${env.name} current ${envTelemetry.dailyRadiationMsv} mSv/day (CSA / RadLab).`
  );
}

function assessBehavioralCircadian(
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  env: MissionEnvironmentConfig
): SystemAssessment {
  let status: TriageStatus = "green";
  let score = 96;
  const findings: string[] = [];

  if (vitals.sleepHours < 5.8) {
    status = "red";
    score -= 36;
    findings.push(
      `Severe sleep deficit (${vitals.sleepHours} hrs/day < 5.8 hrs) impairs EVA cognition & immune defense.`
    );
  } else if (vitals.sleepHours < 6.5) {
    status = "amber";
    score -= Math.round(14 * env.hazardWeights.isolation);
    findings.push(
      `Circadian sleep debt (${vitals.sleepHours} hrs/day vs. 6.5–8.0 hrs space target).`
    );
  } else {
    findings.push(`Sleep duration (${vitals.sleepHours} hrs/day) supports cognitive readiness.`);
  }

  if (vitals.moodScore <= 3) {
    status = maxStatus(status, "red");
    score -= 34;
    findings.push(`Critical behavioral fatigue score (${vitals.moodScore}/10).`);
  } else if (vitals.moodScore <= 5) {
    status = maxStatus(status, "amber");
    score -= Math.round(14 * env.hazardWeights.isolation);
    findings.push(
      `Mood dip (${vitals.moodScore}/10) compounded by ${env.commDelayLabel} isolation load.`
    );
  } else {
    findings.push(`Behavioral mood & crew cohesion score (${vitals.moodScore}/10) nominal.`);
  }

  if (envTelemetry.cabinCo2MmHg > 3.5) {
    score -= 8;
    findings.push(`Cabin CO2 (${envTelemetry.cabinCo2MmHg} mmHg) adds mild cognitive fatigue.`);
  }

  const headline =
    status === "red"
      ? "Circadian Collapse / Behavioral Fatigue"
      : status === "amber"
      ? "Sleep Drift & Isolation Strain"
      : "Circadian & Cognitive Readiness Nominal";

  return buildAssessment(
    "behavioral_circadian",
    status,
    score,
    headline,
    findings,
    `Earth 7–9h sleep / 0s link vs. ${env.name} (${env.commDelayLabel} delay, isolation weight ${env.hazardWeights.isolation}x).`
  );
}

function detectCascades(
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  env: MissionEnvironmentConfig
): CascadeLink[] {
  const cascades: CascadeLink[] = [];

  // 1. Microgravity fluid shift + high BP/CO2 -> Neuro-ocular SANS
  if (
    env.gravityG === 0 &&
    (vitals.bloodPressureSystolic >= 132 ||
      envTelemetry.cabinCo2MmHg > 3.5 ||
      vitals.ocularFinding !== "clear")
  ) {
    const isRed =
      vitals.ocularFinding !== "clear" ||
      envTelemetry.cabinCo2MmHg > 4.0 ||
      vitals.bloodPressureSystolic >= 138;
    cascades.push({
      id: "gravity_fluid_sans",
      title: "Cephalad Fluid Shift + CO2 -> SANS Optic Pressure",
      fromSystem: "cardiovascular",
      toSystem: "neuro_ocular",
      severity: isRed ? "red" : "amber",
      mechanism:
        "0g shifts ~2L fluid headward; elevated BP or cabin CO2 dilates cerebral vessels, raising optic nerve sheath pressure (SANS).",
      triggeredByHazard: "gravity",
      immediateAction:
        "Activate LBNP thigh cuffs, boost cabin CO2 scrubbing, and capture ONSD ocular ultrasound.",
    });
  }

  // 2. Altered gravity bone resorption + low hydration -> Renal calculus
  if (env.gravityG < 1 && vitals.hydrationMl < 2000) {
    const isRed = vitals.hydrationMl < 1500;
    cascades.push({
      id: "bone_calcium_renal",
      title: "Bone Ca2+ Resorption + Dehydration -> Renal Stone",
      fromSystem: "cardiovascular",
      toSystem: "musculoskeletal_renal",
      severity: isRed ? "red" : "amber",
      mechanism:
        "Unloaded bones release calcium into circulation; low urine output (< 2,000 mL/day) supersaturates renal tubules.",
      triggeredByHazard: "gravity",
      immediateAction:
        "Start Potassium Citrate + 600 mL water bolus every 2h and complete ARED bone loading.",
    });
  }

  // 3. Space radiation + sleep deficit -> Immune suppression
  if (
    (envTelemetry.dailyRadiationMsv > 1.2 ||
      envTelemetry.solarFlareClass === "M" ||
      envTelemetry.solarFlareClass === "X") &&
    vitals.sleepHours < 6.5
  ) {
    const isRed =
      envTelemetry.solarFlareClass === "X" ||
      envTelemetry.dailyRadiationMsv >= 2.5 ||
      vitals.sleepHours < 6.0;
    cascades.push({
      id: "radiation_sleep_immune",
      title: "Radiation Dose + Sleep Debt -> Immune Suppression",
      fromSystem: "behavioral_circadian",
      toSystem: "immune_hematology",
      severity: isRed ? "red" : "amber",
      mechanism:
        "Ionizing GCR/SPE radiation paired with circadian cortisol elevation impairs T-cell immunity and reactivates latent viruses.",
      triggeredByHazard: "radiation",
      immediateAction:
        "Move to shielded storm sleep berth, log protected >= 7.5h rest, and screen skin/mucosa.",
    });
  }

  // 4. Isolation/sleep stress + elevated glucose -> Metabolic insulin resistance
  if (
    (vitals.sleepHours < 6.0 || vitals.moodScore <= 4) &&
    vitals.bloodGlucoseMgDl > 110
  ) {
    const isRed =
      vitals.bloodGlucoseMgDl >= 140 ||
      (vitals.sleepHours < 5.5 && vitals.moodScore <= 3);
    cascades.push({
      id: "stress_glucose_metabolic",
      title: "Circadian Stress + Unloading -> Insulin Resistance",
      fromSystem: "behavioral_circadian",
      toSystem: "metabolic_endocrine",
      severity: isRed ? "red" : "amber",
      mechanism:
        "Sleep restriction and isolation stress hormones elevate hepatic glucose output during microgravity muscle unloading.",
      triggeredByHazard: "isolation",
      immediateAction:
        "Shift to low-glycemic nutrition, run 20 min post-meal CEVIS/ARED, and schedule SSLA rest cycle.",
    });
  }

  return cascades;
}

/**
 * Evaluates all 6 astronaut body systems, detects active organ-to-organ cascades,
 * and computes overall Mission Readiness Score (0–100).
 */
export function evaluateCrewHealth(
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  envId: MissionEnvironmentId
): HealthEvaluationResult {
  const env = MISSION_ENVIRONMENTS[envId];
  const clampedVitals = clampVitalReadings(vitals);
  const clampedEnv = clampEnvTelemetry(envTelemetry);

  const systems: Record<BodySystemId, SystemAssessment> = {
    neuro_ocular: assessNeuroOcular(clampedVitals, clampedEnv, env),
    cardiovascular: assessCardiovascular(clampedVitals, env),
    musculoskeletal_renal: assessMusculoskeletalRenal(clampedVitals, env),
    metabolic_endocrine: assessMetabolicEndocrine(clampedVitals, env),
    immune_hematology: assessImmuneHematology(clampedVitals, clampedEnv, env),
    behavioral_circadian: assessBehavioralCircadian(clampedVitals, clampedEnv, env),
  };

  const activeCascades = detectCascades(clampedVitals, clampedEnv, env);

  // Propagate severe cascade escalations onto target organ assessments
  for (const cascade of activeCascades) {
    const target = systems[cascade.toSystem];
    target.status = maxStatus(target.status, cascade.severity);
    target.score = Math.max(
      0,
      target.score - (cascade.severity === "red" ? 14 : 6)
    );
    target.findings = [
      `[CASCADE: ${cascade.title}] ${cascade.mechanism}`,
      ...target.findings,
    ];
  }

  let redCount = 0;
  let amberCount = 0;
  for (const sys of Object.values(systems)) {
    if (sys.status === "red") redCount += 1;
    else if (sys.status === "amber") amberCount += 1;
  }

  // Deep-space / BLEO hazard burden adjustment differentiates environments on identical borderline vitals
  const envBurdenPenalty = Math.round(
    Math.max(
      0,
      (env.hazardWeights.radiation +
        env.hazardWeights.distance +
        env.hazardWeights.isolation -
        2.0) *
        2.5
    )
  );

  const rawReadiness =
    100 -
    redCount * 18 -
    amberCount * 7 -
    activeCascades.length * 5 -
    envBurdenPenalty;

  const readinessScore = Math.round(clampNumber(rawReadiness, 0, 100, 50));

  const overallStatus: TriageStatus =
    redCount > 0 ? "red" : amberCount > 0 || activeCascades.length > 0 ? "amber" : "green";

  const flightSurgeonAlertRequired =
    redCount > 0 || activeCascades.some((c) => c.severity === "red");

  return {
    readinessScore,
    overallStatus,
    autonomousTriageRequired: env.autonomousModeRequired,
    flightSurgeonAlertRequired,
    clampedVitals,
    systems,
    activeCascades,
  };
}

/**
 * Applies a hardware-mapped countermeasure protocol to crew vitals and habitat telemetry
 * with physiological clamping, enabling closed-loop autonomous BioTwin recovery.
 */
export function applyCountermeasureToState(
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  action: CountermeasureActionSpec
): { vitals: VitalReadings; envTelemetry: EnvironmentTelemetry } {
  const nextVitals = clampVitalReadings({
    ...vitals,
    ...(action.vitalsPatch ?? {}),
  });
  const nextEnv = clampEnvTelemetry({
    ...envTelemetry,
    ...(action.envPatch ?? {}),
  });

  return {
    vitals: nextVitals,
    envTelemetry: nextEnv,
  };
}

/**
 * Generates an asynchronous telemetry packet formatted for Ground Flight Surgeons
 * or autonomous crew medical logs when operating under deep-space communication delay.
 */
export function formatFlightSurgeonPacket(
  evaluation: HealthEvaluationResult,
  vitals: VitalReadings,
  envTelemetry: EnvironmentTelemetry,
  envId: MissionEnvironmentId,
  clinicalContext?: FlightSurgeonPacketContext
): string {
  const env = MISSION_ENVIRONMENTS[envId];
  const v = clampVitalReadings(vitals);
  const e = clampEnvTelemetry(envTelemetry);

  const flaggedSystems = (Object.values(evaluation.systems) as SystemAssessment[])
    .filter((s) => s.status !== "green")
    .map(
      (s) =>
        `- [${s.status.toUpperCase()}] ${BODY_SYSTEM_METADATA[s.systemId].name}: ${s.headline} (${BODY_SYSTEM_METADATA[s.systemId].osdrStudyIds.join(", ")})`
    );

  const cascadeLines = evaluation.activeCascades.map(
    (c) => `- [${c.severity.toUpperCase()}] ${c.title} -> Action: ${c.immediateAction}`
  );

  const baseLines = [
    `=== ARES-MED OS :: MEDICAL TELEMETRY PACKET ===`,
    `Environment: ${env.name} (${env.gravityLabel})`,
    `Comm Delay: ${env.commDelayLabel} | Mode: ${
      evaluation.autonomousTriageRequired
        ? "AUTONOMOUS CMO PROTOCOL ACTIVE"
        : "REAL-TIME GROUND LINK"
    }`,
    `Mission Readiness: ${evaluation.readinessScore}/100 | Overall: ${evaluation.overallStatus.toUpperCase()}`,
    `Flight Surgeon Escalation: ${
      evaluation.flightSurgeonAlertRequired ? "YES — PRIORITY TRANSMIT" : "ROUTINE LOG"
    }`,
    ``,
    `[CREW VITALS]`,
    `BP: ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic} mmHg | HR: ${v.heartRateBpm} bpm | Glucose: ${v.bloodGlucoseMgDl} mg/dL | Temp: ${v.bodyTempC} °C`,
    `Sleep: ${v.sleepHours} hrs | Mood: ${v.moodScore}/10 | Hydration: ${v.hydrationMl} mL | Ocular: ${v.ocularFinding} | ARED: ${
      v.aredExerciseCompleted ? "DONE" : "PENDING"
    }`,
    ``,
    `[HABITAT / RADLAB TELEMETRY]`,
    `Cabin CO2: ${e.cabinCo2MmHg} mmHg | Temp: ${e.cabinTempC} °C | Humidity: ${e.cabinHumidityPct}%`,
    `Radiation: ${e.dailyRadiationMsv} mSv/day (GCR ${e.gcrDoseMsv} + SAA/SPE ${e.saaOrSpeDoseMsv}) | Solar Flare: ${e.solarFlareClass}`,
    ``,
    `[FLAGGED ORGAN SYSTEMS]`,
    ...(flaggedSystems.length > 0 ? flaggedSystems : ["- All 6 anatomical systems nominal."]),
    ``,
    `[ACTIVE DOMINO CASCADES]`,
    ...(cascadeLines.length > 0 ? cascadeLines : ["- No active multi-organ cascades."]),
  ];

  if (!clinicalContext) {
    return baseLines.join("\n");
  }

  const extraLines: string[] = [];

  if (
    clinicalContext.telemetryMode ||
    clinicalContext.biometricSource ||
    clinicalContext.issSnapshot
  ) {
    extraLines.push(``, `[HARDWARE TELEMETRY PROVENANCE]`);
    if (clinicalContext.telemetryMode) {
      extraLines.push(`- Multiplexer Mode: ${clinicalContext.telemetryMode.toUpperCase()}`);
    }
    if (clinicalContext.biometricSource) {
      extraLines.push(`- Biometric Source: ${clinicalContext.biometricSource}`);
    }
    if (clinicalContext.issSnapshot) {
      const snap = clinicalContext.issSnapshot;
      extraLines.push(
        `- ISS Orbital State (${snap.source}): Lat ${snap.orbital.latitude}°, Lon ${snap.orbital.longitude}°, Alt ${snap.orbital.altitudeKm} km, SAA Belt: ${snap.orbital.inSouthAtlanticAnomaly ? "ACTIVE" : "CLEAR"}`
      );
      const uslabCo2 = snap.symbols.USLAB000058;
      const node3Wrs = snap.symbols.NODE3000005;
      if (uslabCo2 && node3Wrs) {
        extraLines.push(
          `- ISS ETHOS Symbols: USLAB000058=${uslabCo2.value}${uslabCo2.unit}, NODE3000005=${node3Wrs.value}${node3Wrs.unit}`
        );
      }
    }
  }

  if (clinicalContext.subStructure) {
    extraLines.push(
      ``,
      `[PINNED 3D ANATOMICAL FOCUS]`,
      `- ${clinicalContext.subStructure.displayLabel} (${clinicalContext.subStructure.layer} · ${clinicalContext.subStructure.tissueTag})`
    );
  }

  const examEntries = Object.entries(clinicalContext.examFindings ?? {}).filter(
    ([, finding]) => finding.status !== "pending"
  );
  extraLines.push(``, `[CMO GUIDED SELF-EXAM LOG]`);
  if (examEntries.length > 0) {
    for (const [key, finding] of examEntries) {
      const valueText = finding.measuredValue ? ` [${finding.measuredValue}]` : "";
      const noteText = finding.note ? ` — ${finding.note}` : "";
      extraLines.push(
        `- ${key}: ${finding.status.toUpperCase()}${valueText}${noteText}`
      );
    }
  } else {
    extraLines.push(`- No verified self-exam steps logged yet.`);
  }

  const executed = clinicalContext.executedActions ?? [];
  extraLines.push(``, `[EXECUTED COUNTERMEASURES]`);
  if (executed.length > 0) {
    for (const act of executed) {
      extraLines.push(
        `- [${act.timestamp}] ${act.label} (${act.deltaSummary})`
      );
    }
  } else {
    extraLines.push(`- None executed during this triage window.`);
  }

  return [...baseLines, ...extraLines].join("\n");
}

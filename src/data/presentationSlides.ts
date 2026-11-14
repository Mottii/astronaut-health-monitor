import type { ClinicalVisualMode } from "@/components/BioTwin3DStage";
import type { BodySystemId, ScenarioId } from "@/types/health";

export interface SlideMetricPair {
  label: string;
  earthValue: string;
  spaceValue: string;
  unit: string;
  critical?: boolean;
}

export interface PresentationSlide {
  id: string;
  chapterCode: string;
  chapterLabel: string;
  kicker: string;
  title: string;
  summary: string;
  ctaLabel: string;
  scenarioId: ScenarioId;
  focusSystem: BodySystemId;
  cameraPreset: "full" | BodySystemId;
  visualMode: ClinicalVisualMode;
  autoRotate: boolean;
  osdrRefs: string[];
  metrics: [SlideMetricPair, SlideMetricPair];
}

export const PRESENTATION_SLIDES: PresentationSlide[] = [
  {
    id: "mission-overview",
    chapterCode: "01",
    chapterLabel: "MISSION",
    kicker: "CHAPTER 01 // DEEP-SPACE AUTONOMY",
    title: "AUTONOMOUS MEDICINE FOR DEEP SPACE",
    summary:
      "At 225M km, 14m 20s one-way signal delay makes real-time Flight Surgeon guidance impossible — and Earth clinical baselines fail in altered gravity.",
    ctaLabel: "BEGIN BIOTWIN SCAN",
    scenarioId: "nominal",
    focusSystem: "cardiovascular",
    cameraPreset: "full",
    visualMode: "atlas",
    autoRotate: true,
    osdrRefs: ["NASA HRP", "OSDR EDA"],
    metrics: [
      {
        label: "One-Way Signal Delay",
        earthValue: "0.001 s",
        spaceValue: "14m 20s",
        unit: "Mars Transit",
      },
      {
        label: "Cabin CO₂ Baseline",
        earthValue: "0.3",
        spaceValue: "<= 3.0",
        unit: "mmHg",
      },
    ],
  },
  {
    id: "neuro-ocular-sans",
    chapterCode: "02",
    chapterLabel: "NEURO-OCULAR",
    kicker: "CASCADE 01 // CEPHALAD FLUID SHIFT",
    title: "FLUID SHIFT & CO₂ STRAIN VISION",
    summary:
      "Microgravity shifts ~2 L of fluid toward the head. Compounded by 4.2 mmHg cabin CO₂, intracranial pressure flattens the posterior eye globe (SANS).",
    ctaLabel: "NEXT: CARDIOVASCULAR",
    scenarioId: "sans_co2_fluid_shift",
    focusSystem: "neuro_ocular",
    cameraPreset: "neuro_ocular",
    visualMode: "xray",
    autoRotate: false,
    osdrRefs: ["OSD-48", "OSD-255"],
    metrics: [
      {
        label: "Cabin pCO₂ (OSDR EDA)",
        earthValue: "0.3",
        spaceValue: "4.2",
        unit: "mmHg",
        critical: true,
      },
      {
        label: "Systolic Arterial Shift",
        earthValue: "95–120",
        spaceValue: "138",
        unit: "mmHg",
        critical: true,
      },
    ],
  },
  {
    id: "cardiovascular-adaptation",
    chapterCode: "03",
    chapterLabel: "CARDIOVASCULAR",
    kicker: "CASCADE 02 // BARORECEPTOR RESET",
    title: "VASCULAR LOAD IN 0G MICROGRAVITY",
    summary:
      "Absent hydrostatic gradients shrink plasma volume by 10–15% while baroreceptors recalibrate, driving orthostatic intolerance and cranial venous congestion.",
    ctaLabel: "NEXT: RENAL & BONE",
    scenarioId: "sans_co2_fluid_shift",
    focusSystem: "cardiovascular",
    cameraPreset: "cardiovascular",
    visualMode: "vascular",
    autoRotate: false,
    osdrRefs: ["OSD-48", "HRP SANS"],
    metrics: [
      {
        label: "Resting Heart Rate",
        earthValue: "60–100",
        spaceValue: "84 (52–88)",
        unit: "bpm",
      },
      {
        label: "Blood Pressure (0g)",
        earthValue: "110 / 75",
        spaceValue: "138 / 88",
        unit: "mmHg",
        critical: true,
      },
    ],
  },
  {
    id: "renal-bone-calcium",
    chapterCode: "04",
    chapterLabel: "RENAL & BONE",
    kicker: "CASCADE 03 // HYPERCALCIURIA",
    title: "BONE CALCIUM LOSS → RENAL STONES",
    summary:
      "Unloaded bones release 1–1.5% calcium per month. Skipping ARED resistive exercise with low hydration (1,200 mL) triggers acute kidney stone risk.",
    ctaLabel: "NEXT: RADIATION",
    scenarioId: "renal_dehydration",
    focusSystem: "musculoskeletal_renal",
    cameraPreset: "musculoskeletal_renal",
    visualMode: "xray",
    autoRotate: false,
    osdrRefs: ["OSD-37", "OSD-48"],
    metrics: [
      {
        label: "Daily Hydration",
        earthValue: "2,000",
        spaceValue: "1,200",
        unit: "mL/day",
        critical: true,
      },
      {
        label: "ARED Bone Loading",
        earthValue: "1g Gravity",
        spaceValue: "MISSED",
        unit: "Protocol",
        critical: true,
      },
    ],
  },
  {
    id: "radiation-immune",
    chapterCode: "05",
    chapterLabel: "RADIATION",
    kicker: "CASCADE 04 // SOLAR PARTICLE EVENT",
    title: "X-FLARE RADIATION & IMMUNE DROP",
    summary:
      "An X-class Solar Particle Event (3.2 mSv/day) combined with 5.8h sleep debt suppresses T-cell immunity and reactivates latent viruses.",
    ctaLabel: "NEXT: METABOLIC",
    scenarioId: "solar_storm",
    focusSystem: "immune_hematology",
    cameraPreset: "immune_hematology",
    visualMode: "atlas",
    autoRotate: false,
    osdrRefs: ["OSD-530", "CSA RadLab"],
    metrics: [
      {
        label: "Daily Radiation Dose",
        earthValue: "0.008",
        spaceValue: "3.20",
        unit: "mSv/day",
        critical: true,
      },
      {
        label: "Core Body Temp",
        earthValue: "36.8",
        spaceValue: "37.9",
        unit: "°C",
        critical: true,
      },
    ],
  },
  {
    id: "metabolic-circadian",
    chapterCode: "06",
    chapterLabel: "METABOLIC",
    kicker: "CASCADE 05 // ISOLATION & SLEEP DEBT",
    title: "CIRCADIAN DRIFT & INSULIN SHIFT",
    summary:
      "16 orbital sunrises/day and confinement stress elevate cortisol, shifting fasting glucose toward subclinical insulin resistance.",
    ctaLabel: "OPEN FULL CMO CONSOLE",
    scenarioId: "renal_dehydration",
    focusSystem: "metabolic_endocrine",
    cameraPreset: "metabolic_endocrine",
    visualMode: "atlas",
    autoRotate: false,
    osdrRefs: ["OSD-104", "OSD-570"],
    metrics: [
      {
        label: "Fasting Blood Glucose",
        earthValue: "70–99",
        spaceValue: "116",
        unit: "mg/dL",
        critical: true,
      },
      {
        label: "Daily Sleep Duration",
        earthValue: "7.0–9.0",
        spaceValue: "5.7",
        unit: "hrs/day",
        critical: true,
      },
    ],
  },
];

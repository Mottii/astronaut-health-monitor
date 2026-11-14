import type {
  BodySystemId,
  BodySystemMetadata,
  EarthVsSpaceRange,
  HazardId,
  MissionEnvironmentConfig,
  MissionEnvironmentId,
  MissionScenario,
  NasaHazardInfo,
  RoutineTask,
  SolTelemetryPoint,
} from "@/types/health";

export const NASA_HAZARDS: Record<HazardId, NasaHazardInfo> = {
  radiation: {
    id: "radiation",
    name: "Space Radiation",
    shortLabel: "Radiation",
    description:
      "Galactic Cosmic Rays (GCR), South Atlantic Anomaly (SAA) trapped protons, and Solar Particle Events (SPE) elevate immune, CNS, and carcinogenic risk beyond Earth's magnetosphere.",
    referenceUrl: "https://www.nasa.gov/hrp/hazards/",
  },
  isolation: {
    id: "isolation",
    name: "Isolation & Confinement",
    shortLabel: "Isolation",
    description:
      "Extended confinement in small habitats triggers circadian drift, behavioral fatigue, mood drops, and heightened neuroendocrine stress hormones.",
    referenceUrl: "https://www.nasa.gov/hrp/hazards/",
  },
  distance: {
    id: "distance",
    name: "Distance from Earth",
    shortLabel: "Distance / Delay",
    description:
      "One-way radio delays up to 14–22 minutes on Mars preclude real-time ground telemetry, requiring autonomous crew medical triage and self-treatment.",
    referenceUrl: "https://www.nasa.gov/hrp/hazards/",
  },
  gravity: {
    id: "gravity",
    name: "Gravity Fields (Altered Gravity)",
    shortLabel: "Gravity Fields",
    description:
      "Microgravity (0g) and partial gravity (0.16g Moon, 0.38g Mars) drive cephalad fluid shifts (SANS), plasma volume loss, and 1–1.5%/month bone calcium resorption.",
    referenceUrl: "https://www.nasa.gov/hrp/hazards/",
  },
  closed_env: {
    id: "closed_env",
    name: "Hostile Closed Environments",
    shortLabel: "Closed Habitat",
    description:
      "Recirculated cabin atmospheres accumulate CO2 (hypercapnia), alter skin/gut microbiomes, and raise thermal or perchlorate/lunar-dust exposure risks.",
    referenceUrl: "https://www.nasa.gov/hrp/hazards/",
  },
};

export const MISSION_ENVIRONMENTS: Record<
  MissionEnvironmentId,
  MissionEnvironmentConfig
> = {
  iss_orbit: {
    id: "iss_orbit",
    name: "ISS (Low Earth Orbit)",
    subtitle: "400 km LEO · US Lab / Cupola · Real-Time Flight Surgeon Link",
    gravityG: 0,
    gravityLabel: "0g Microgravity",
    commDelayLabel: "~0.001s (Real-time)",
    commDelaySeconds: 0.001,
    autonomousModeRequired: false,
    activeHazards: ["gravity", "closed_env", "radiation", "isolation"],
    hazardWeights: {
      radiation: 0.9,
      isolation: 0.85,
      distance: 0.1,
      gravity: 1.35,
      closed_env: 1.15,
    },
    defaultTelemetry: {
      cabinCo2MmHg: 2.8,
      cabinTempC: 22.4,
      cabinHumidityPct: 44,
      dailyRadiationMsv: 0.5,
      gcrDoseMsv: 0.28,
      saaOrSpeDoseMsv: 0.22,
      solarFlareClass: "None",
    },
  },
  lunar_rover: {
    id: "lunar_rover",
    name: "Lunar Surface Rover",
    subtitle: "384,400 km BLEO · Pressurized EVA Rover · 0.16g",
    gravityG: 0.16,
    gravityLabel: "0.16g Lunar Gravity",
    commDelayLabel: "1.3s (One-way)",
    commDelaySeconds: 1.3,
    autonomousModeRequired: false,
    activeHazards: ["radiation", "closed_env", "gravity", "distance"],
    hazardWeights: {
      radiation: 1.3,
      isolation: 1.0,
      distance: 0.4,
      gravity: 1.05,
      closed_env: 1.25,
    },
    defaultTelemetry: {
      cabinCo2MmHg: 3.1,
      cabinTempC: 21.8,
      cabinHumidityPct: 41,
      dailyRadiationMsv: 1.1,
      gcrDoseMsv: 0.85,
      saaOrSpeDoseMsv: 0.25,
      solarFlareClass: "None",
    },
  },
  mars_transit: {
    id: "mars_transit",
    name: "Deep-Space Mars Transit",
    subtitle: "225M km BLEO · Autonomous CMO Protocol Mandatory",
    gravityG: 0,
    gravityLabel: "0g Microgravity",
    commDelayLabel: "14m 20s (One-way)",
    commDelaySeconds: 860,
    autonomousModeRequired: true,
    activeHazards: ["distance", "radiation", "isolation", "gravity", "closed_env"],
    hazardWeights: {
      radiation: 1.5,
      isolation: 1.35,
      distance: 1.5,
      gravity: 1.4,
      closed_env: 1.2,
    },
    defaultTelemetry: {
      cabinCo2MmHg: 3.4,
      cabinTempC: 22.0,
      cabinHumidityPct: 43,
      dailyRadiationMsv: 1.8,
      gcrDoseMsv: 1.45,
      saaOrSpeDoseMsv: 0.35,
      solarFlareClass: "None",
    },
  },
  mars_base: {
    id: "mars_base",
    name: "Mars Surface Habitat",
    subtitle: "225M km Surface Base · Regolith Shielded · 0.38g",
    gravityG: 0.38,
    gravityLabel: "0.38g Martian Gravity",
    commDelayLabel: "14m 20s (One-way)",
    commDelaySeconds: 860,
    autonomousModeRequired: true,
    activeHazards: ["distance", "isolation", "closed_env", "gravity", "radiation"],
    hazardWeights: {
      radiation: 1.05,
      isolation: 1.3,
      distance: 1.5,
      gravity: 0.95,
      closed_env: 1.3,
    },
    defaultTelemetry: {
      cabinCo2MmHg: 3.0,
      cabinTempC: 21.2,
      cabinHumidityPct: 39,
      dailyRadiationMsv: 0.7,
      gcrDoseMsv: 0.58,
      saaOrSpeDoseMsv: 0.12,
      solarFlareClass: "None",
    },
  },
};

export const EARTH_VS_SPACE_RANGES: EarthVsSpaceRange[] = [
  {
    metricKey: "bloodPressureSystolic",
    label: "Blood Pressure",
    unit: "mmHg",
    earthNormal: "95–120 / 60–80",
    spaceflightAdjusted: "100–128 / 65–84 (0g shift)",
    rationale:
      "Microgravity eliminates the hydrostatic blood column, shifting ~2L of fluid toward the head and shifting central arterial pressure baselines.",
  },
  {
    metricKey: "heartRateBpm",
    label: "Resting Heart Rate",
    unit: "bpm",
    earthNormal: "60–100",
    spaceflightAdjusted: "52–88 (Vagal adaptation)",
    rationale:
      "Reduced gravitational workload lowers resting cardiac output slightly while orthostatic tachycardia risks spike during EVA or re-entry.",
  },
  {
    metricKey: "bloodGlucoseMgDl",
    label: "Fasting Blood Glucose",
    unit: "mg/dL",
    earthNormal: "70–99",
    spaceflightAdjusted: "75–110 (Subclinical IR)",
    rationale:
      "Muscle unloading and elevated cortisol induce mild spaceflight insulin resistance (NASA OSDR OSD-104).",
  },
  {
    metricKey: "bodyTempC",
    label: "Core Body Temperature",
    unit: "°C",
    earthNormal: "36.1–37.2",
    spaceflightAdjusted: "36.3–37.5 (Thermoregulatory shift)",
    rationale:
      "Absent natural convection in 0g impairs sweat evaporation, causing slight basal core elevation during exercise or EVA.",
  },
  {
    metricKey: "sleepHours",
    label: "Daily Sleep Duration",
    unit: "hrs/day",
    earthNormal: "7.0–9.0",
    spaceflightAdjusted: "6.5–8.0 (16 sunrises/day)",
    rationale:
      "90-minute orbital light cycles on ISS and Mars 24h 39m Sols disrupt melatonin unless blue-light countermeasures are maintained.",
  },
  {
    metricKey: "hydrationMl",
    label: "Daily Hydration",
    unit: "mL/day",
    earthNormal: "2,000–2,500",
    spaceflightAdjusted: ">= 2,400 (Renal threshold)",
    rationale:
      "Bone calcium mobilization in altered gravity requires higher urine volume to prevent calcium oxalate/phosphate kidney stones.",
  },
  {
    metricKey: "cabinCo2MmHg",
    label: "Cabin CO2 Partial Pressure",
    unit: "mmHg",
    earthNormal: "0.3 (Ambient)",
    spaceflightAdjusted: "<= 3.0 (OSDR EDA Target)",
    rationale:
      "Closed habitats run 8–10x higher CO2 than Earth; > 3.5 mmHg precipitates headaches, cognitive slowing, and SANS optic strain.",
  },
  {
    metricKey: "dailyRadiationMsv",
    label: "Daily Radiation Dose",
    unit: "mSv/day",
    earthNormal: "0.008 (Sea level)",
    spaceflightAdjusted: "0.5 LEO / 1.8 Deep Space",
    rationale:
      "NASA OSDR RadLab & CSA dosimetry track GCR + SAA/SPE bursts to protect hematology and CNS tissue.",
  },
];

export const BODY_SYSTEM_METADATA: Record<BodySystemId, BodySystemMetadata> = {
  neuro_ocular: {
    id: "neuro_ocular",
    name: "Neuro-Ocular & Vestibular",
    shortLabel: "Head / Eyes",
    organSummary:
      "Brain, intracranial venous drainage, optic nerve sheath, and vestibular inner ear.",
    nasaHrpRiskTitle:
      "Spaceflight-Associated Neuro-ocular Syndrome (SANS) & Intracranial Hypertension",
    nasaHrpUrl: "https://www.nasa.gov/hrp/risks/",
    osdrStudyIds: ["OSD-48", "OSD-255"],
    whyExamNeededInSpace:
      "In microgravity, ~2 liters of blood and interstitial fluid shift upward into the head. Combined with elevated closed-cabin CO2, this raises optic nerve sheath pressure and flattens the posterior globe—potentially causing permanent hyperopic vision shifts if caught late.",
    primaryHazards: ["gravity", "closed_env", "distance"],
    selfExamSteps: [
      {
        stepNumber: 1,
        title: "Near-Vision Amsler Grid & Acuity Self-Check",
        instruction:
          "Cover one eye at a time at 35 cm reading distance and inspect the Amsler grid for wavy lines, blind spots, or sudden near-focus blurriness.",
        normalObservation: "Grid lines appear crisp, straight, and uniform in both eyes.",
        escalationTrigger: "New near-vision blurriness, wavy lines, or visual halos.",
      },
      {
        stepNumber: 2,
        title: "Handheld Ocular Ultrasound (ONSD) Capture",
        instruction:
          "Apply gel over closed eyelid and align the linear probe laterally to measure Optic Nerve Sheath Diameter (ONSD) 3 mm behind the globe.",
        normalObservation: "ONSD <= 5.0 mm with flat posterior globe contour.",
        escalationTrigger: "ONSD > 5.5 mm or visible optic disc flattening/edema.",
      },
      {
        stepNumber: 3,
        title: "Cabin CO2 & Cephalad Pressure Cross-Check",
        instruction:
          "Compare headache or pressure severity against current OSDR EDA cabin pCO2 reading and blood pressure.",
        normalObservation: "Cabin CO2 <= 3.0 mmHg and zero morning frontal headache.",
        escalationTrigger: "Cabin CO2 > 3.5 mmHg accompanied by throbbing headache or vision shift.",
      },
    ],
    countermeasures: [
      "Engage Lower Body Negative Pressure (LBNP) Chibis/thigh cuffs 30 min to draw cephalad fluid downward.",
      "Switch local ventilation / CDRA CO2 scrubber loop to high-flow mode if cabin pCO2 > 3.5 mmHg.",
      "Perform repeat handheld fundoscopy & ONSD ultrasound in 12 hours; apply Space Anticipation Glasses if hyperopic shift confirmed.",
    ],
    flightSurgeonCriteria:
      "Transmit fundus + ONSD ultrasound packet immediately if visual halos persist, ONSD > 5.5 mm, or systolic BP >= 140 mmHg.",
    svgCoords: { cx: 140, cy: 48 },
  },
  cardiovascular: {
    id: "cardiovascular",
    name: "Cardiovascular System",
    shortLabel: "Heart / Vascular",
    organSummary:
      "Myocardium, arterial baroreceptors, and central plasma volume regulation.",
    nasaHrpRiskTitle: "Risk of Cardiovascular Adaptations & Orthostatic Intolerance",
    nasaHrpUrl: "https://www.nasa.gov/hrp/risks/",
    osdrStudyIds: ["OSD-135"],
    whyExamNeededInSpace:
      "Without Earth's 1g pull, plasma volume drops 10–15% within days and carotid baroreceptors decondition. While resting heart rate can appear deceptively normal in 0g, astronauts risk sudden syncope during Lunar/Martian surface gravity transitions or EVA exertion.",
    primaryHazards: ["gravity", "radiation", "closed_env"],
    selfExamSteps: [
      {
        stepNumber: 1,
        title: "Resting Supine/Neutral Cuff Blood Pressure & Pulse",
        instruction:
          "Rest quietly for 5 minutes tethered in neutral posture, then record systolic/diastolic pressure and resting HR from wrist/cuff monitor.",
        normalObservation: "HR 52–88 bpm and BP within 100–128 / 65–84 mmHg.",
        escalationTrigger: "Resting HR > 100 bpm, < 45 bpm, or BP >= 135/88 mmHg.",
      },
      {
        stepNumber: 2,
        title: "Pre-EVA / Gravity-Transition Orthostatic Check",
        instruction:
          "Before stepping onto a planetary surface (0.16g/0.38g), test pulse delta after 3 minutes of upright compression or LBNP stand-test.",
        normalObservation: "HR rise < 25 bpm with stable systolic pressure and zero dizziness.",
        escalationTrigger: "Presyncope, lightheadedness, or HR surge > 30 bpm.",
      },
      {
        stepNumber: 3,
        title: "Cardiac Rhythm & Cap-Refill Screen",
        instruction:
          "Palpate radial pulse for 30 seconds for skipped beats and check fingernail capillary refill (< 2 sec).",
        normalObservation: "Regular rhythm and brisk < 2 sec capillary refill.",
        escalationTrigger: "Irregular rhythm, chest tightness, or delayed perfusion.",
      },
    ],
    countermeasures: [
      "Execute NASA Fluid-Loading Protocol (salt tablets + 1,000 mL isotonic electrolyte intake) prior to gravity transitions.",
      "Complete 30 min aerobic cycle ergometer (CEVIS) + ARED session to preserve left-ventricular mass.",
      "Activate lower-extremity compression garments if orthostatic symptoms appear.",
    ],
    flightSurgeonCriteria:
      "Alert Flight Surgeons if sustained BP >= 140/90 mmHg, resting tachycardia > 105 bpm, or arrhythmia detected.",
    svgCoords: { cx: 148, cy: 118 },
  },
  musculoskeletal_renal: {
    id: "musculoskeletal_renal",
    name: "Skeletal & Renal System",
    shortLabel: "Bone / Kidneys",
    organSummary:
      "Weight-bearing trabecular bone (lumbar spine, femoral neck) and renal filtration.",
    nasaHrpRiskTitle:
      "Spaceflight-Induced Bone Mineral Loss & Renal Stone Cascade",
    nasaHrpUrl: "https://www.nasa.gov/hrp/risks/",
    osdrStudyIds: ["OSD-48", "OSD-37"],
    whyExamNeededInSpace:
      "Weightlessness triggers rapid osteoclastic bone resorption (~1–1.5% mineral loss per month), releasing excess calcium into blood and urine. Combined with low crew hydration, urinary calcium supersaturates and forms incapacitating kidney stones mid-mission.",
    primaryHazards: ["gravity", "closed_env", "distance"],
    selfExamSteps: [
      {
        stepNumber: 1,
        title: "Daily Urine Specific Gravity & Volume Check",
        instruction:
          "Log total 24h water intake and inspect urine color strip / dipstick specific gravity and microhematuria pad.",
        normalObservation: "Hydration >= 2,400 mL/day, pale straw urine, zero blood/crystals.",
        escalationTrigger: "Hydration < 1,800 mL/day, dark concentrated urine, or dipstick hematuria.",
      },
      {
        stepNumber: 2,
        title: "Costovertebral Angle (Flank) Tenderness Screen",
        instruction:
          "Gently percuss left and right lower back below the 12th rib while checking for sharp radiating flank pain.",
        normalObservation: "Zero flank tenderness or urinary urgency.",
        escalationTrigger: "Unilateral flank ache, nausea, or colicky pain.",
      },
      {
        stepNumber: 3,
        title: "ARED Resistive Loading & Mobility Verification",
        instruction:
          "Confirm daily Advanced Resistive Exercise Device (squat/deadlift/heel raise) completion to mechanically load femur and lumbar vertebrae.",
        normalObservation: "Daily resistive protocol logged without joint instability.",
        escalationTrigger: "Missed > 2 consecutive ARED sessions or acute lumbar strain.",
      },
    ],
    countermeasures: [
      "Initiate immediate Potassium Citrate prophylaxis + 600 mL water bolus every 2 hours until daily intake exceeds 2,500 mL.",
      "Perform ARED axial-loading resistance workout (minimum 45 min/day) to suppress osteoclast activity.",
      "Run renal ultrasound scan for hydronephrosis if flank pain develops.",
    ],
    flightSurgeonCriteria:
      "High-priority Flight Surgeon alert (and autonomous analgesia protocol on Mars) if renal colic, gross hematuria, or hydration < 1,500 mL with fever occurs.",
    svgCoords: { cx: 124, cy: 172 },
  },
  metabolic_endocrine: {
    id: "metabolic_endocrine",
    name: "Metabolic & Endocrine",
    shortLabel: "Metabolic / Sugar",
    organSummary:
      "Pancreatic beta-cell insulin sensitivity, hepatic glycogen output, and thermoregulation.",
    nasaHrpRiskTitle: "Inadequate Nutrition & Spaceflight Insulin Resistance",
    nasaHrpUrl: "https://www.nasa.gov/hrp/risks/",
    osdrStudyIds: ["OSD-104"],
    whyExamNeededInSpace:
      "NASA studies (including OSDR OSD-104) demonstrate that microgravity muscle unloading and sleep-deprivation cortisol spikes induce subclinical insulin resistance. Monitoring blood glucose in mg/dL alongside nutrition prevents metabolic fatigue and wound-healing delays.",
    primaryHazards: ["gravity", "isolation", "closed_env"],
    selfExamSteps: [
      {
        stepNumber: 1,
        title: "Fasting Capillary Blood Glucose (mg/dL)",
        instruction:
          "Use sterile micro-lancet and flight glucometer prior to first mission meal (or 2h post-prandial).",
        normalObservation: "Fasting 75–110 mg/dL (post-meal < 140 mg/dL).",
        escalationTrigger: "Fasting > 115 mg/dL, < 65 mg/dL, or persistent upward trend.",
      },
      {
        stepNumber: 2,
        title: "Oral / Tympanic Core Temperature Check",
        instruction:
          "Record sublingual/tympanic temperature at rest before EVA or heavy CEVIS exercise.",
        normalObservation: "36.3–37.5 °C in microgravity.",
        escalationTrigger: "Temp >= 38.0 °C (infection/heat stress) or < 35.5 °C.",
      },
      {
        stepNumber: 3,
        title: "Caloric & Micronutrient (Vitamin D / Omega-3) Audit",
        instruction:
          "Verify daily intake meets ISS metabolic budget and Vitamin D supplementation (800–1000 IU/day without UV sunlight).",
        normalObservation: ">= 90% planned kcal consumed + Vitamin D supplement taken.",
        escalationTrigger: "Appetite suppression > 48 hours or symptomatic hypoglycemia.",
      },
    ],
    countermeasures: [
      "Shift meal macro ratio toward low-glycemic complex carbohydrates and pair meals with 20 min post-meal resistive/cardio activity.",
      "Hydrate and verify glucometer calibration strip batch if reading < 65 or > 140 mg/dL.",
      "Take Vitamin D3 supplement and rebalance cabin thermal cooling loop if core temp >= 37.8 °C.",
    ],
    flightSurgeonCriteria:
      "Escalate if blood glucose < 60 mg/dL or >= 180 mg/dL, or if fever >= 38.2 °C persists beyond 12 hours.",
    svgCoords: { cx: 158, cy: 158 },
  },
  immune_hematology: {
    id: "immune_hematology",
    name: "Immune & Hematology",
    shortLabel: "Immune / Rad",
    organSummary:
      "Bone marrow stem cells, T-lymphocytes, red blood cell mass, and radiation-sensitive tissues.",
    nasaHrpRiskTitle:
      "Altered Immune System Responses & Space Radiation Tissue Effects",
    nasaHrpUrl: "https://www.nasa.gov/hrp/risks/",
    osdrStudyIds: ["OSD-530"],
    partnerReference:
      "CSA Monitoring Radiation for Astronaut Health & NASA OSDR RadLab (DosTel/REM-Lid)",
    whyExamNeededInSpace:
      "Space radiation (GCR + Solar Particle Events) combined with isolation stress suppresses T-cell function, reactivates latent herpesviruses (shingles/cold sores), and triggers 'space anemia' via elevated hemolysis.",
    primaryHazards: ["radiation", "isolation", "closed_env"],
    selfExamSteps: [
      {
        stepNumber: 1,
        title: "RadLab / CSA Personal Dosimeter Sync",
        instruction:
          "Read cumulative and 24h absorbed dose (mSv) from body-worn dosimeter and cross-check live NASA DONKI solar flare status.",
        normalObservation: "<= 0.6 mSv/day in LEO (<= 1.8 mSv/day nominal deep space).",
        escalationTrigger: "Daily dose > 2.0 mSv/day or active M/X-class Solar Particle Event.",
      },
      {
        stepNumber: 2,
        title: "Skin, Mucosa & Lymph Node Self-Exam",
        instruction:
          "Inspect torso/face for vesicular rash, hives, or oral ulcers (latent viral reactivation) and palpate neck/axillary lymph nodes.",
        normalObservation: "Intact skin, no tender lymphadenopathy, normal temperature.",
        escalationTrigger: "Dermatomal rash, fever >= 37.8 °C, or swollen lymph nodes.",
      },
      {
        stepNumber: 3,
        title: "Hemoglobin / Fatigue Screening",
        instruction:
          "Check non-invasive pulse-oximeter SpHb/SpO2 sensor for post-flight or high-radiation hemoglobin dips.",
        normalObservation: "SpO2 >= 96% and stable exertional recovery.",
        escalationTrigger: "SpO2 < 93% or acute unexplained fatigue following SPE event.",
      },
    ],
    countermeasures: [
      "Relocate immediately to high-density polyethylene / water-wall Radiation Storm Shelter during active M/X Solar Flares.",
      "Prioritize >= 7.5 hours protected sleep and antioxidant-rich space diet to counter radiation-induced oxidative stress.",
      "Apply topical/oral antiviral protocol from onboard medical kit if latent viral lesions appear.",
    ],
    flightSurgeonCriteria:
      "Immediate Radiation Officer & Flight Surgeon alert on X-class solar flare exposure > 2.5 mSv/day or febrile rash.",
    svgCoords: { cx: 140, cy: 144 },
  },
  behavioral_circadian: {
    id: "behavioral_circadian",
    name: "Behavioral & Circadian",
    shortLabel: "Sleep / Mood",
    organSummary:
      "Suprachiasmatic circadian pacemaker, prefrontal cognitive focus, and stress resilience.",
    nasaHrpRiskTitle:
      "Behavioral Changes, Sleep Loss & Circadian Desynchronization",
    nasaHrpUrl: "https://www.nasa.gov/hrp/risks/",
    osdrStudyIds: ["OSD-255"],
    whyExamNeededInSpace:
      "Orbiting Earth every 90 minutes exposes crew to 16 sunrises/day, while Mars missions stretch into 24h 39m Sols under extreme isolation and 14–20 minute comm blackouts. Sleep debt below 6 hours impairs EVA safety and cascades into metabolic and immune suppression.",
    primaryHazards: ["isolation", "distance", "closed_env"],
    selfExamSteps: [
      {
        stepNumber: 1,
        title: "Sleep Duration & Fragmentation Log",
        instruction:
          "Record total sleep hours over the last 24h and note awakenings from cabin fan noise or CO2 discomfort.",
        normalObservation: ">= 6.5–8.0 hours uninterrupted sleep.",
        escalationTrigger: "< 6.0 hours for >= 2 consecutive Sols.",
      },
      {
        stepNumber: 2,
        title: "3-Minute Psychomotor Vigilance & Mood Self-Score",
        instruction:
          "Rate subjective mood/energy (1–10) and verify reaction clarity before high-consequence rover/robotic operations.",
        normalObservation: "Mood score >= 6/10 with steady situational awareness.",
        escalationTrigger: "Mood score <= 4/10, persistent irritability, or slowed reaction.",
      },
      {
        stepNumber: 3,
        title: "Crew Cohesion & Earth-Link Check",
        instruction:
          "Verify asynchronous family/crew audio message sync during high-latency Mars phases.",
        normalObservation: "Positive crew check-in and stable schedule adherence.",
        escalationTrigger: "Social withdrawal or conflict impacting mission checklists.",
      },
    ],
    countermeasures: [
      "Run 30 min Solid-State Lighting Assembly (SSLA) 480nm blue-enriched wake light at mission morning.",
      "Enforce 90-minute pre-sleep amber dim mode, zero caffeine within 8h of sleep, and ear-protection acoustic masking.",
      "Schedule private asynchronous crew debrief or autonomous CBT/breathwork module.",
    ],
    flightSurgeonCriteria:
      "Notify Behavioral Health & Flight Surgeon if mood <= 3/10 for > 72 hours or severe insomnia compromises EVA safety.",
    svgCoords: { cx: 112, cy: 66 },
  },
};

export const DEMO_SCENARIOS: MissionScenario[] = [
  {
    id: "nominal",
    name: "Nominal ISS Routine",
    badge: "All Nominal",
    description:
      "Standard Low Earth Orbit crew status on ISS with OSDR EDA cabin CO2 <= 3.0 mmHg, proper hydration, and completed ARED exercise.",
    environmentId: "iss_orbit",
    focusSystem: "cardiovascular",
    vitals: {
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      heartRateBpm: 66,
      bloodGlucoseMgDl: 92,
      bodyTempC: 36.8,
      sleepHours: 7.4,
      moodScore: 8,
      hydrationMl: 2550,
      ocularFinding: "clear",
      aredExerciseCompleted: true,
    },
    envTelemetry: {
      ...MISSION_ENVIRONMENTS.iss_orbit.defaultTelemetry,
    },
  },
  {
    id: "sans_co2_fluid_shift",
    name: "Fluid Shift + CO2 (SANS)",
    badge: "Neuro-Ocular Cascade",
    description:
      "Microgravity cephalad fluid shift compounded by elevated closed-cabin CO2 (4.2 mmHg), triggering cardiovascular -> neuro-ocular SANS pressure.",
    environmentId: "iss_orbit",
    focusSystem: "neuro_ocular",
    vitals: {
      bloodPressureSystolic: 138,
      bloodPressureDiastolic: 88,
      heartRateBpm: 84,
      bloodGlucoseMgDl: 98,
      bodyTempC: 37.1,
      sleepHours: 6.4,
      moodScore: 6,
      hydrationMl: 2300,
      ocularFinding: "blurry_near",
      aredExerciseCompleted: true,
    },
    envTelemetry: {
      cabinCo2MmHg: 4.2,
      cabinTempC: 23.6,
      cabinHumidityPct: 52,
      dailyRadiationMsv: 0.55,
      gcrDoseMsv: 0.3,
      saaOrSpeDoseMsv: 0.25,
      solarFlareClass: "None",
    },
  },
  {
    id: "renal_dehydration",
    name: "Bone Ca2+ -> Renal Stone",
    badge: "Mars Autonomous Triage",
    description:
      "Deep-space Mars transit (14m 20s comm delay): missed ARED + dehydration (1,200 mL) concentrates mobilized bone calcium, risking acute renal stone.",
    environmentId: "mars_transit",
    focusSystem: "musculoskeletal_renal",
    vitals: {
      bloodPressureSystolic: 124,
      bloodPressureDiastolic: 80,
      heartRateBpm: 88,
      bloodGlucoseMgDl: 116,
      bodyTempC: 37.3,
      sleepHours: 5.7,
      moodScore: 4,
      hydrationMl: 1200,
      ocularFinding: "clear",
      aredExerciseCompleted: false,
    },
    envTelemetry: {
      ...MISSION_ENVIRONMENTS.mars_transit.defaultTelemetry,
      cabinCo2MmHg: 3.3,
    },
  },
  {
    id: "solar_storm",
    name: "Solar Particle Event (X-Flare)",
    badge: "CSA / RadLab Alert",
    description:
      "Lunar surface rover exposed to an X-class Solar Particle Event (3.2 mSv/day) alongside sleep debt (5.8 hrs), cascading into immune suppression.",
    environmentId: "lunar_rover",
    focusSystem: "immune_hematology",
    vitals: {
      bloodPressureSystolic: 126,
      bloodPressureDiastolic: 82,
      heartRateBpm: 92,
      bloodGlucoseMgDl: 108,
      bodyTempC: 37.9,
      sleepHours: 5.8,
      moodScore: 5,
      hydrationMl: 2100,
      ocularFinding: "clear",
      aredExerciseCompleted: true,
    },
    envTelemetry: {
      cabinCo2MmHg: 3.2,
      cabinTempC: 22.9,
      cabinHumidityPct: 45,
      dailyRadiationMsv: 3.2,
      gcrDoseMsv: 0.9,
      saaOrSpeDoseMsv: 2.3,
      solarFlareClass: "X",
    },
  },
];

export const DEFAULT_ROUTINE_TASKS: RoutineTask[] = [
  {
    id: "ared_load",
    title: "ARED Resistive Bone-Loading Protocol",
    category: "musculoskeletal_renal",
    xp: 40,
    durationMin: 45,
    nasaProtocolNote: "Counters 1–1.5%/mo microgravity trabecular bone resorption.",
  },
  {
    id: "amsler_ocular",
    title: "Morning Amsler & Ocular Acuity Check",
    category: "neuro_ocular",
    xp: 25,
    durationMin: 5,
    nasaProtocolNote: "Early screening for Spaceflight-Associated Neuro-ocular Syndrome.",
  },
  {
    id: "renal_hydration",
    title: "Hydration Target (>= 2,400 mL) & Citrate",
    category: "musculoskeletal_renal",
    xp: 30,
    durationMin: 5,
    nasaProtocolNote: "Prevents hypercalciuric renal stone formation in altered gravity.",
  },
  {
    id: "radlab_sync",
    title: "CSA / RadLab Dosimeter & Storm Check",
    category: "immune_hematology",
    xp: 25,
    durationMin: 3,
    nasaProtocolNote: "Tracks daily GCR + SAA/SPE mSv exposure against career limits.",
  },
  {
    id: "circadian_ssla",
    title: "SSLA Blue-Light Wake & Mood Log",
    category: "behavioral_circadian",
    xp: 20,
    durationMin: 10,
    nasaProtocolNote: "Stabilizes melatonin rhythm across orbital/Martian day-night shifts.",
  },
];

const ISS_HISTORY: SolTelemetryPoint[] = [
  { sol: "Sol 1", heartRateBpm: 68, systolicBp: 120, bloodGlucoseMgDl: 91, sleepHours: 7.3, moodScore: 8, issCabinCo2MmHg: 2.5, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.27, saaDoseMsv: 0.21, totalRadiationMsv: 0.48 },
  { sol: "Sol 2", heartRateBpm: 67, systolicBp: 119, bloodGlucoseMgDl: 93, sleepHours: 7.1, moodScore: 8, issCabinCo2MmHg: 2.6, groundControlCo2MmHg: 0.34, gcrDoseMsv: 0.28, saaDoseMsv: 0.20, totalRadiationMsv: 0.48 },
  { sol: "Sol 3", heartRateBpm: 69, systolicBp: 121, bloodGlucoseMgDl: 94, sleepHours: 6.9, moodScore: 7, issCabinCo2MmHg: 2.8, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.28, saaDoseMsv: 0.23, totalRadiationMsv: 0.51 },
  { sol: "Sol 4", heartRateBpm: 66, systolicBp: 118, bloodGlucoseMgDl: 90, sleepHours: 7.5, moodScore: 8, issCabinCo2MmHg: 2.7, groundControlCo2MmHg: 0.36, gcrDoseMsv: 0.27, saaDoseMsv: 0.22, totalRadiationMsv: 0.49 },
  { sol: "Sol 5", heartRateBpm: 70, systolicBp: 122, bloodGlucoseMgDl: 96, sleepHours: 6.8, moodScore: 7, issCabinCo2MmHg: 3.1, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.29, saaDoseMsv: 0.24, totalRadiationMsv: 0.53 },
  { sol: "Sol 6", heartRateBpm: 72, systolicBp: 124, bloodGlucoseMgDl: 95, sleepHours: 6.6, moodScore: 7, issCabinCo2MmHg: 3.3, groundControlCo2MmHg: 0.34, gcrDoseMsv: 0.28, saaDoseMsv: 0.25, totalRadiationMsv: 0.53 },
  { sol: "Sol 7", heartRateBpm: 68, systolicBp: 120, bloodGlucoseMgDl: 92, sleepHours: 7.2, moodScore: 8, issCabinCo2MmHg: 2.9, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.28, saaDoseMsv: 0.21, totalRadiationMsv: 0.49 },
  { sol: "Sol 8", heartRateBpm: 65, systolicBp: 117, bloodGlucoseMgDl: 89, sleepHours: 7.6, moodScore: 9, issCabinCo2MmHg: 2.6, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.27, saaDoseMsv: 0.20, totalRadiationMsv: 0.47 },
  { sol: "Sol 9", heartRateBpm: 67, systolicBp: 118, bloodGlucoseMgDl: 91, sleepHours: 7.4, moodScore: 8, issCabinCo2MmHg: 2.7, groundControlCo2MmHg: 0.36, gcrDoseMsv: 0.28, saaDoseMsv: 0.22, totalRadiationMsv: 0.50 },
  { sol: "Sol 10", heartRateBpm: 68, systolicBp: 120, bloodGlucoseMgDl: 93, sleepHours: 7.1, moodScore: 8, issCabinCo2MmHg: 2.9, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.29, saaDoseMsv: 0.23, totalRadiationMsv: 0.52 },
  { sol: "Sol 11", heartRateBpm: 66, systolicBp: 119, bloodGlucoseMgDl: 92, sleepHours: 7.3, moodScore: 8, issCabinCo2MmHg: 2.8, groundControlCo2MmHg: 0.34, gcrDoseMsv: 0.28, saaDoseMsv: 0.22, totalRadiationMsv: 0.50 },
  { sol: "Sol 12", heartRateBpm: 67, systolicBp: 118, bloodGlucoseMgDl: 90, sleepHours: 7.5, moodScore: 8, issCabinCo2MmHg: 2.7, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.27, saaDoseMsv: 0.21, totalRadiationMsv: 0.48 },
  { sol: "Sol 13", heartRateBpm: 66, systolicBp: 118, bloodGlucoseMgDl: 92, sleepHours: 7.4, moodScore: 8, issCabinCo2MmHg: 2.8, groundControlCo2MmHg: 0.35, gcrDoseMsv: 0.28, saaDoseMsv: 0.22, totalRadiationMsv: 0.50 },
];

export const BASE_14_SOL_HISTORY: Record<MissionEnvironmentId, SolTelemetryPoint[]> = {
  iss_orbit: ISS_HISTORY,
  lunar_rover: ISS_HISTORY.map((pt, idx) => ({
    ...pt,
    heartRateBpm: pt.heartRateBpm + (idx % 3 === 0 ? 6 : 4),
    issCabinCo2MmHg: Number((pt.issCabinCo2MmHg + 0.3).toFixed(2)),
    gcrDoseMsv: Number((pt.gcrDoseMsv + 0.57).toFixed(2)),
    saaDoseMsv: Number((pt.saaDoseMsv + 0.03).toFixed(2)),
    totalRadiationMsv: Number((pt.gcrDoseMsv + 0.57 + pt.saaDoseMsv + 0.03).toFixed(2)),
  })),
  mars_transit: ISS_HISTORY.map((pt, idx) => ({
    ...pt,
    heartRateBpm: pt.heartRateBpm + 3,
    bloodGlucoseMgDl: pt.bloodGlucoseMgDl + (idx > 6 ? 8 : 3),
    sleepHours: Number((pt.sleepHours - 0.5).toFixed(1)),
    moodScore: Math.max(5, pt.moodScore - 1),
    issCabinCo2MmHg: Number((pt.issCabinCo2MmHg + 0.5).toFixed(2)),
    gcrDoseMsv: Number((pt.gcrDoseMsv + 1.17).toFixed(2)),
    saaDoseMsv: Number((pt.saaDoseMsv + 0.13).toFixed(2)),
    totalRadiationMsv: Number((pt.gcrDoseMsv + 1.17 + pt.saaDoseMsv + 0.13).toFixed(2)),
  })),
  mars_base: ISS_HISTORY.map((pt) => ({
    ...pt,
    heartRateBpm: pt.heartRateBpm + 2,
    sleepHours: Number((pt.sleepHours - 0.3).toFixed(1)),
    issCabinCo2MmHg: Number((pt.issCabinCo2MmHg + 0.2).toFixed(2)),
    gcrDoseMsv: Number((pt.gcrDoseMsv + 0.3).toFixed(2)),
    saaDoseMsv: 0.12,
    totalRadiationMsv: Number((pt.gcrDoseMsv + 0.3 + 0.12).toFixed(2)),
  })),
};

# ARES-MED OS — BioTwin Cascade & Autonomous CMO Design Specification

**Date:** 2026-11-14  
**Event:** 2026 NASA International Space Apps Challenge (Almaty)  
**Challenge:** [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)  
**Repository:** `Mottii/astronaut-health-monitor`

---

## 1. Intent & The Why

Long-duration missions (NASA Artemis, ISS operations, and future Moon-to-Mars expeditions) expose crew members to NASA's **5 Hazards of Human Spaceflight**:
1. **Space Radiation**
2. **Isolation and Confinement**
3. **Distance from Earth** (up to ~20+ minutes one-way communication latency)
4. **Gravity Fields** (microgravity `0g` or partial gravity `0.16g` / `0.38g`)
5. **Hostile, Closed Environments** (elevated cabin $\text{CO}_2$, closed-loop air/water, temperature/humidity shifts)

On deep-space missions, astronauts cannot rely on real-time Flight Surgeon supervision from Earth, nor can they evaluate their readings against terrestrial health apps. Physiological baselines shift in space (e.g., cephalad fluid shift alters blood pressure and intracranial/ocular pressure; bone mineral resorption dumps calcium into the bloodstream, increasing renal stone risk; elevated cabin $\text{CO}_2$ amplifies headaches and neuro-ocular symptoms).

**ARES-MED OS** is an autonomous, visual crew health monitoring and medical triage console that connects spacecraft/habitat environmental telemetry with personal physiological indicators, maps organ-to-organ hazard cascades on an interactive human body figure, and guides non-physician crew members through step-by-step self-exams and evidence-based NASA countermeasures.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **3-Layer NASA Open Data Architecture:**
  1. **Layer 1 — Habitat & Space Weather Telemetry:** Integrate curated baselines from **NASA OSDR Environmental Data Application (EDA)** (cabin $\text{CO}_2$ in `mmHg`, temperature in `°C`, relative humidity `%`, and GCR vs. SAA radiation doses), **NASA OSDR RadLab** (LEO vs. BLEO radiation profiles across modules/environments), and live solar flare / Solar Energetic Particle (SEP) alerts from **NASA DONKI (`api.nasa.gov/DONKI/FLR` using `DEMO_KEY`)** with deterministic offline fallback.
  2. **Layer 2 — Personal Vitals & Multimodal Crew Inputs:** Capture and track Blood Pressure (`systolic/diastolic mmHg`), Heart Rate (`bpm`), Blood Glucose (`mg/dL`), Body Temperature (`°C`), Daily Sleep (`hrs`), Mood/Behavioral Score (`1–10`), Daily Hydration (`mL`), and quick Ocular/Ultrasound self-check findings.
  3. **Layer 3 — NASA HRP Risk & Organ Cascade Engine:** Compare **Earth Normal Baseline** vs. **Spaceflight-Adjusted Baseline** across 6 anatomical systems, compute color-coded triage statuses (`Green`, `Amber`, `Red`), detect active multi-organ **Domino Cascades**, and cite real NASA HRP risks and OSDR study accessions (`OSD-48`, `OSD-37`, `OSD-104`, `OSD-135`, `OSD-255`, `OSD-530`).
- **Interactive BioTwin Anatomical Body Map:** Clickable SVG human figure with color-coded system nodes (`Green = Nominal`, `Amber = Spaceflight Adaptation / Caution`, `Red = Autonomous Intervention / Flight Surgeon Escalation`) and animated cascade connectors.
- **Autonomous Crew Medical Officer (CMO) Guided Triage Tree:** Plain-language, 3-step self-assessment workflow (*Why Exam is Needed in Space* -> *Interactive Symptom & Self-Exam Check* -> *Immediate NASA HRP Countermeasure Plan vs. Ground Flight Surgeon Telemetry Packet*).
- **Multi-Environment Context & Instant Judge Demos:** Support **4 Mission Environments** (`ISS Low Earth Orbit`, `Lunar Surface Rover`, `Deep-Space Mars Transit`, `Mars Surface Habitat`) and **4 One-Click Demo Scenarios** (*Nominal Crew Routine*, *Solar Particle Event / Radiation Spike*, *Microgravity Fluid-Shift & High Cabin CO2 (SANS)*, *Bone Demineralization & Dehydration Renal Cascade*).
- **Gamified Daily Mission Routine:** Interactive daily countermeasure & self-check checklist with Mission Readiness Score (`0–100`), XP counter, and Sol streak persisted in `localStorage`.

### Non-Goals
- No paid external AI APIs or subscription LLM calls.
- No backend database, login wall, or authentication barrier that slows down hackathon judges.
- No custom ML model training pipelines or large binary assets (`Git LFS` prohibited per `github.com/nasa/instructions`).

### Anti-Goals
- Must **NOT** look or behave like a generic Earth fitness dashboard (e.g., Apple Health / Fitbit clone). Every metric and alert must explicitly surface **Spaceflight Context**: Earth vs. Space baseline comparison, active NASA Hazards, habitat $\text{CO}_2$/radiation linkage, and communication-delay autonomy guidance.

---

## 3. Approaches Considered & Selected Architecture

| Approach | Description | Trade-offs | Decision |
| :--- | :--- | :--- | :--- |
| **Approach 1: BioTwin Cascade** | Interactive anatomical body map showing Earth-vs-Space baseline shifts and live organ-to-organ domino chain reactions. | Strong visual impact & physiological validity; needs clear clinical next steps when an organ turns Amber/Red. | **Selected (Core UI & Engine)** |
| **Approach 2: Autonomous CMO Decision Tree** | Step-by-step non-doctor diagnostic flowchart and countermeasure protocol built for 14–20 min Mars radio latency. | High operational authenticity; slightly text/form-heavy on its own without a spatial visual overview. | **Selected (Integrated into Right Panel)** |
| **Approach 3: Webcam PPG & RPG Quest** | Browser webcam pulse detection + full RPG game loop. | Webcam PPG is brittle under variable hackathon venue lighting; heavy game framing weakens clinical Validity. | **Rejected as primary** *(kept lightweight Routine Streak/XP checklist)* |

**Selected Stack:**
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript (strict mode)
- **Styling & Icons:** Tailwind CSS + `lucide-react` (dark-mode NASA Open MCT-inspired telemetry aesthetic)
- **Charts:** `recharts` (14-Sol vital trend charts with Earth vs. Space baseline bands + ISS vs. Ground EDA environmental comparison)
- **Testing:** `vitest` + `@vitest/coverage-v8` (or core Vitest suite for engine & API layers)
- **Hosting:** Static/edge deployment ready for Vercel & GitHub (`Mottii/astronaut-health-monitor`)

---

## 4. Domain Specification & Rules

### 4.1 Mission Environments (`MissionEnvironmentId`)

| Environment ID | Label | Gravity | One-Way Comm Delay | Baseline Radiation | Baseline Cabin $\text{CO}_2$ | Primary Active Hazards |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `iss_orbit` | ISS (Low Earth Orbit) | `0g` | `~0.001s` (Real-time) | `0.5 mSv/day` (GCR + SAA) | `2.8 mmHg` | Gravity Fields, Hostile Closed Env, Radiation |
| `lunar_rover` | Lunar Surface Rover | `0.16g` | `1.3s` | `1.1 mSv/day` (BLEO) | `3.1 mmHg` | Radiation, Closed Suit/Rover, Dust & Decompression |
| `mars_transit` | Deep-Space Mars Transit | `0g` | `14m 20s` (Autonomous) | `1.8 mSv/day` (GCR + SPE) | `3.4 mmHg` | Distance from Earth, Radiation, Isolation, Gravity |
| `mars_base` | Mars Surface Habitat | `0.38g` | `14m 20s` (Autonomous) | `0.7 mSv/day` (Shielded) | `3.0 mmHg` | Distance from Earth, Isolation, Closed Habitat, Gravity |

### 4.2 Six Clickable Anatomical Body Systems (`BodySystemId`)

1. **`neuro_ocular`** — *Neuro-Ocular & Vestibular (Brain, Optic Nerve, Inner Ear)*
   - **NASA HRP Risk:** Spaceflight-Associated Neuro-ocular Syndrome (SANS) & Intracranial Hypertension; Cabin $\text{CO}_2$ hypercapnia effects.
   - **OSDR Reference:** `OSD-48` / `OSD-255` (ocular & CNS tissue adaptation).
   - **Indicators Monitored:** Systolic/Diastolic BP, Cabin $\text{CO}_2$ (`mmHg`), Ocular Self-Check (`clear` | `blurry_near` | `visual_halos`), Sleep Hours.
2. **`cardiovascular`** — *Cardiovascular System (Heart & Baroreceptors)*
   - **NASA HRP Risk:** Cardiovascular Adaptations (cephalad fluid shift, plasma volume reduction, orthostatic intolerance).
   - **OSDR Reference:** `OSD-135` (spaceflight cardiac & vascular remodeling).
   - **Indicators Monitored:** Heart Rate (`bpm`), Systolic/Diastolic BP (`mmHg`), Gravity Field (`0g`/`0.16g`/`0.38g`).
3. **`musculoskeletal_renal`** — *Skeletal & Renal System (Spine, Femur, Kidneys)*
   - **NASA HRP Risk:** Spaceflight-Induced Bone Changes (~1–1.5%/month bone mineral density loss) & Renal Stone Formation.
   - **OSDR Reference:** `OSD-48` / `OSD-37` (bone resorption & left-kidney physiological studies).
   - **Indicators Monitored:** Hydration (`mL/day`), Gravity Field, Daily ARED Resistance Exercise completion.
4. **`metabolic_endocrine`** — *Metabolic & Endocrine (Pancreas, Liver, Nutrition)*
   - **NASA HRP Risk:** Inadequate Nutrition & Subclinical Spaceflight Insulin Resistance.
   - **OSDR Reference:** `OSD-104` (metabolic & hepatic gene-expression response).
   - **Indicators Monitored:** Blood Glucose (`mg/dL`), Body Temperature (`°C`), Sleep Hours.
5. **`immune_hematology`** — *Immune & Hematology (Spleen, Marrow, WBCs)*
   - **NASA HRP Risk:** Altered Immune System Responses (latent viral reactivation, space anemia) & Radiation Degenerative Effects (CSA Radiation Monitoring).
   - **OSDR Reference:** `OSD-530` / NASA OSDR RadLab (`DosTel1/2`, `REM-Lid`).
   - **Indicators Monitored:** Daily Radiation (`mSv/day`), Solar Flare Class (`None` | `C` | `M` | `X`), Body Temperature (`°C`), Sleep Hours.
6. **`behavioral_circadian`** — *Behavioral & Circadian (CNS, Mood, Sleep)*
   - **NASA HRP Risk:** Behavioral Changes, Psychiatric Disorders & Inadequate Sleep / Circadian Desynchronization.
   - **Indicators Monitored:** Daily Sleep (`hrs`), Mood/Stress Score (`1–10`), Cabin $\text{CO}_2$ (`mmHg`), Mission Comm Delay / Isolation load.

### 4.3 Multi-Organ Domino Cascade Rules (`CascadeLink`)

1. **`gravity_fluid_sans`** (`cardiovascular` -> `neuro_ocular`):
   - **Trigger:** Microgravity (`0g`) AND (Systolic BP $\ge 132\text{ mmHg}$ OR Cabin $\text{CO}_2 > 3.5\text{ mmHg}$ OR Ocular Check $\ne \text{clear}$).
   - **Mechanism:** Cephalad fluid shift + $\text{CO}_2$-induced cerebral vasodilation increases intracranial and optic nerve sheath pressure (SANS).
2. **`bone_calcium_renal`** (`musculoskeletal_renal` internal / `cardiovascular` -> `musculoskeletal_renal`):
   - **Trigger:** Altered gravity (`< 1g`) AND Hydration $< 2000\text{ mL/day}$ (escalates to `Red` if Hydration $< 1500\text{ mL/day}$).
   - **Mechanism:** Unloaded bones release $\text{Ca}^{2+}$ into serum; low urine volume concentrates urinary calcium, driving rapid renal calculus formation.
3. **`radiation_sleep_immune`** (`behavioral_circadian` -> `immune_hematology`):
   - **Trigger:** (Daily Radiation $> 1.2\text{ mSv/day}$ OR Active Solar Flare `M`/`X`) AND Sleep $< 6.5\text{ hrs/day}$.
   - **Mechanism:** Combined cosmic/solar ionizing radiation and circadian cortisol dysregulation suppress T-cell immunity and trigger latent viral reactivation.
4. **`stress_glucose_metabolic`** (`behavioral_circadian` -> `metabolic_endocrine`):
   - **Trigger:** (Sleep $< 6.0\text{ hrs/day}$ OR Mood $\le 4$) AND Blood Glucose $> 110\text{ mg/dL}$.
   - **Mechanism:** Chronic isolation stress hormones elevate hepatic glucose output and amplify spaceflight insulin resistance.

---

## 5. UX & Visual Architecture

- **Console Header:** Mission Branding (`ARES-MED OS`), Environment Selector (4 contexts), Live NASA DONKI Solar Weather Pill + Comm Latency Indicator, Mission Readiness Score (`0–100`), and 4 One-Click Scenario Presets.
- **3-Column Responsive Grid:**
  - **Left Column (`BioTwinBodyMap`):** Dark telemetry SVG human silhouette with 6 interactive organ nodes (`Green`/`Amber`/`Red` glow), animated bezier cascade connectors linking triggered organs, and a clickable cascade alert list.
  - **Center Column (`VitalsInputPanel` + `TelemetryCharts`):**
    - Quick numeric inputs/sliders for all 7 core indicators + Ocular/Ultrasound self-check selector + Environment $\text{CO}_2$/Radiation override.
    - Earth Baseline vs. Spaceflight Adjusted Baseline comparison badges.
    - Recharts 14-Sol dynamic trend chart (toggleable across HR/BP, Blood Glucose, Sleep/Mood, and EDA Cabin $\text{CO}_2$ + RadLab GCR/SAA radiation).
  - **Right Column (`AutonomousCmoPanel` + `RoutineGamificationBar`):**
    - **Autonomous CMO Guided Triage:** Tabbed/stepped card for the currently selected body system: *1. Why Exam Matters in Space (HRP + OSDR Citation)* -> *2. 3-Step Self-Exam Checklist* -> *3. Countermeasure Plan & Ground Flight Surgeon Telemetry Packet Generator* (copyable JSON/text summary calibrated to comm delay).
    - **Gamified Daily Mission Routine:** Interactive daily self-care tasks (+XP, Sol streak, progress bar, persisted safely in `localStorage`).

---

## 6. Verification & Submission Standards

- **Automated Verification:** Unit tests via `vitest` covering all triage boundary values, cascade triggers, environment switching, invalid/NaN clamping, and NASA DONKI API live/fallback parsing; TypeScript check (`npx tsc --noEmit`) and Next.js production build (`npm run build`).
- **Repository Hygiene:** Keep `README.md`, `meta.json`, and `LICENSE` compliant with `github.com/nasa/instructions` and Space Apps Almaty submission guidelines.

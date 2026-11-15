# ARES-MED OS — Astronaut Health & BioTwin Countermeasure Monitor

**Autonomous Crew Medical Officer (CMO) clinical console, 3D BioTwin anatomical atlas, pre-flight biological twin laboratory, and telemetry hardware bridge for deep-space Artemis and Mars missions.**  
Built for the **2026 NASA Space Apps Challenge (Almaty)**.

> **Simulation & Clinical Disclaimer:** All astronaut profiles (`ARES-1`–`ARES-3`), synthetic telemetry presets, Amsler Grid / ONSD ocular ultrasound walkthroughs, and pharmacokinetic/pharmacodynamic (PK/PD) models in this repository are educational simulations grounded in published NASA Human Research Program (HRP), OSDR, CSA, and Spaceflight Standard Measures (SMO 016E / SOMA) literature. This software is **not** medical advice or flight-certified diagnostic instrumentation.

---

## Overview & Three Application Surfaces

ARES-MED OS treats human physiology in altered gravity as a closed-loop multi-organ system rather than isolated Earth-normal vitals, spanning three integrated Next.js App Router surfaces:

1. **3D Orbital Briefing (`/`)** — Continuous circular 7-chapter scroll-driven Three.js story (`01 ARES-MED` → `02 MISSION` → `03 NEURO-OCULAR` → `04 CARDIOVASCULAR` → `05 RENAL & BONE` → `06 RADIATION` → `07 METABOLIC`) with projected SVG anatomical callout leaders, constellation starfield background ([`AmbientField.tsx`](src/components/AmbientField.tsx)), `Reduce Motion` toggle, and direct transition into the CMO console.
2. **Autonomous CMO Clinical Console (`/?mode=console`)** — 100dvh 3-zone operational dashboard:
   - **Zone A (Mission Header):** Mission environment switcher, Crew Profile selector + link to `/preflight`, 4 Judge Demo Scenarios, drawers for Hardware Bridge, 14-Sol Telemetry Charts / Vitals Input, Countermeasure Routine Tracker, live NASA DONKI flare sync, Slides return toggle, and overall Mission Readiness badge (`0–100`).
   - **Zone B (Clinical Workspace):** Left-hand interactive **3D BioTwin** anatomical canvas (with **2D Blueprint** SVG toggle) + `3×2` organ switcher + real-time **Domino Cascade** monitor alongside the right-hand **4-stage Autonomous CMO Decision Deck**.
   - **Zone C (Bottom Telemetry Dock):** 6-channel biometric stepper & sparkline strip (`HR`, `BP mmHg`, `Cabin pCO2`, `RadLab`, `Hydration`, `Sleep`).
3. **Pre-Flight Biological Twin Lab (`/preflight`)** — L-180 / L-90 astronaut baseline laboratory with 4 operational views (`Dossier & Ingestion`, `Qualification & Sim`, `Model & API Engine`, `Manual Overrides`): drag-and-drop JSON/TXT/CSV dossier ingestion (offline binary PDF rejection), SOMA pharmacogenomic markers (`MTRR A66G`, `CYP2D6`, `CYP2C9`, `ATM`), SMO 016E biochemical baselines, 4 JSC Qualification Stress Assays, cross-organ drug contraindication evaluation, and dual-inference engine routing.

---

## Three-Layer Domain Architecture

| Layer | Core Modules | Responsibility |
| :--- | :--- | :--- |
| **1. Clinical Thresholds & BioTwin Calibration** | [`clinicalThresholds.ts`](src/lib/clinicalThresholds.ts), [`twinEngine.ts`](src/lib/twinEngine.ts) | Spaceflight-adjusted ranges, `REFERENCE_BASELINE` constants, per-organ biological sensitivity multipliers, and PK/PD drug simulation |
| **2. Multi-Organ Cascade Triage Engine** | [`triageEngine.ts`](src/lib/triageEngine.ts) | Evaluates 6 body systems, detects 5 cross-organ/pharmacogenomic domino cascades, propagates penalties, and computes environment-burden-adjusted Readiness (`0–100`) |
| **3. Spaceflight Telemetry & Hardware Bridge** | [`telemetryMultiplexer.ts`](src/lib/telemetryMultiplexer.ts), [`biometricBridge.ts`](src/lib/biometricBridge.ts), [`issLiveTelemetry.ts`](src/lib/issLiveTelemetry.ts), [`nasaApi.ts`](src/lib/nasaApi.ts) | Multiplexes preset scenarios, live CSA Astroskin / Web BLE / rPPG / REST telemetry, live ISS/SAA coordinates, NASA DONKI flares, and NASA OSDR study metadata |

---

## NASA's 5 Hazards, Mission Environments & Domino Cascades

ARES-MED OS evaluates physiology across **NASA HRP's 5 Hazards of Human Spaceflight** (*Space Radiation*, *Isolation & Confinement*, *Distance from Earth*, *Gravity Fields*, *Hostile Closed Environments*) and **4 Mission Environments** ([`src/data/nasaHrpData.ts`](src/data/nasaHrpData.ts)):

| Environment ID | Mission Profile | Gravity | One-Way Comm Delay | Autonomous CMO Required |
| :--- | :--- | :--- | :--- | :--- |
| `iss_orbit` | ISS (Low Earth Orbit) | `0g` Microgravity | `~0.001s` (Real-time) | No |
| `lunar_rover` | Lunar Surface Rover | `0.16g` Lunar Gravity | `1.3s` (One-way) | No |
| `mars_transit` | Deep-Space Mars Transit | `0g` Microgravity | `14m 20s` (One-way) | **Yes** |
| `mars_base` | Mars Surface Habitat | `0.38g` Martian Gravity | `14m 20s` (One-way) | **Yes** |

### Six Tracked Body Systems & Five Detected Cascades (`triageEngine.ts`)

Evaluates `neuro_ocular`, `cardiovascular`, `musculoskeletal_renal`, `metabolic_endocrine`, `immune_hematology`, and `behavioral_circadian`, detecting five multi-organ cascade links:

1. **`gravity_fluid_sans` (`cardiovascular` → `neuro_ocular`):** `0g` cephalad ~2L fluid shift combined with systolic BP (`>= 132 mmHg`), cabin CO₂ (`> 3.5 mmHg`), or ocular findings drives intracranial venous congestion and optic nerve sheath strain (SANS).
2. **`bone_calcium_renal` (`cardiovascular` → `musculoskeletal_renal`):** Altered gravity (`< 1g`) bone Ca²⁺ resorption paired with low hydration (`< 2,000 mL/day`, red `< 1,500 mL/day`) supersaturates renal tubules and elevates kidney stone risk.
3. **`radiation_sleep_immune` (`behavioral_circadian` → `immune_hematology`):** Elevated radiation (`> 1.2 mSv/day` or M/X-class solar flare) compounded by sleep deficit (`< 6.5 hrs/day`) suppresses T-cell immunity and increases viral-reactivation risk.
4. **`stress_glucose_metabolic` (`behavioral_circadian` → `metabolic_endocrine`):** Circadian restriction (`< 6.0 hrs` sleep or mood `<= 4/10`) with hyperglycemia (`> 110 mg/dL`) amplifies hepatic insulin resistance during muscle unloading.
5. **`drug_acetazolamide_renal` (`neuro_ocular` → `musculoskeletal_renal`):** Stateful pharmacogenomic/urinary alkalinization trap triggered when active Acetazolamide exposure (`neuro_acetazolamide_rx`) occurs in a stone-susceptible BioTwin profile → acute CaPO₄ nephrolithiasis risk.

---

## Earth Normal vs. Spaceflight-Adjusted Clinical Baselines

| Parameter | Earth Normal | Spaceflight Adjusted (ISS / BLEO) | Physiological Rationale |
| :--- | :--- | :--- | :--- |
| **Blood Pressure** | `95–120 / 60–80 mmHg` | `100–128 / 65–84 mmHg` (`0g` shift) | Microgravity eliminates hydrostatic column, shifting ~2L fluid headward |
| **Resting Heart Rate** | `60–100 bpm` | `52–88 bpm` (Vagal adaptation) | Lower resting cardiac workload in `0g`; orthostatic risk spikes on EVA/re-entry |
| **Fasting Blood Glucose** | `70–99 mg/dL` | `75–110 mg/dL` (Subclinical IR) | Muscle unloading and cortisol drive mild insulin resistance (`OSD-104`) |
| **Core Body Temperature** | `36.1–37.2 °C` | `36.3–37.5 °C` (Thermoregulatory shift) | Lack of natural convection in `0g` slows sweat evaporation |
| **Daily Sleep Duration** | `7.0–9.0 hrs/day` | `6.5–8.0 hrs/day` (16 sunrises/day) | 90-min LEO light cycles and Mars 24h 39m Sols disrupt circadian rhythm |
| **Daily Hydration** | `2,000–2,500 mL/day` | `>= 2,400 mL/day` (Renal threshold) | Dilutes mobilized calcium from `~1–1.5%/mo` unloaded bone resorption |
| **Cabin CO₂ Pressure** | `0.3 mmHg` (Ambient) | `<= 3.0 mmHg` (OSDR EDA target) | Closed-loop habitats run 8–10x Earth pCO₂; `> 3.5 mmHg` stresses SANS & cognition |
| **Daily Radiation Dose** | `0.008 mSv/day` (Sea level) | `0.5 LEO / 1.8 Deep Space mSv/day` | GCR, South Atlantic Anomaly (SAA) protons, and Solar Particle Events (SPE) |

---

## 3D BioTwin Anatomical Atlas & Orbital Briefing

### Reproducible Blender + Three.js Model Pipeline
- **Runtime 3D Assets:** [`public/models/ares-biotwin.glb`](public/models/ares-biotwin.glb) (`~12.0 MB` torso shell, `Skeletal_Frame`, `Organ_*` sub-meshes), [`public/models/skeleton.glb`](public/models/skeleton.glb) (`~5.2 MB` clavicle and upper-limb framing), and [`public/models/ares-logo.glb`](public/models/ares-logo.glb) (`~52 KB` insignia).
- **Open-Source Anatomy Generation:** [`scripts/fetch_opensource_anatomy.py`](scripts/fetch_opensource_anatomy.py) downloads **25 NIH / HuBMAP Visible Human Male (CC-BY 4.0)** `.glb` reference organ meshes, and [`scripts/build_biotwin_glb.py`](scripts/build_biotwin_glb.py) assembles and fits them headlessly in Blender, verified against [`shellContainment.ts`](src/lib/shellContainment.ts) bounds.
- **Clinical Shaders & Dual Fallback ([`BioTwin3DStage.tsx`](src/components/BioTwin3DStage.tsx), [`BioTwinBodyMap.tsx`](src/components/BioTwinBodyMap.tsx)):**
  - `atlas` — Anatomical surface lighting with per-organ triage glow.
  - `xray` — Fresnel translucent `Outer_Body_Shell` emphasizing skeleton and organs.
  - `vascular` — High-contrast fluid-shift / hemodynamic shader (`UnrealBloomPass` post-processing).
  - Supports click/hover sub-structure raycasting, auto-rotate toggle, camera reset, and one-click switching to the **2D Blueprint** SVG diagram.

### Briefing Controls (`/`)
- **Navigation:** Vertical mouse wheel (circular 7-chapter loop via [`briefingPath.ts`](src/lib/briefingPath.ts)), `ArrowUp` / `ArrowDown` / `PageUp` / `PageDown` / `Home` / `End`, `[` / `]`, horizontal drag, or right-side chapter dots.
- **Accessibility & Audio:** Respects OS `prefers-reduced-motion` and provides a UI `Reduce Motion` toggle ([`useReducedMotion.ts`](src/hooks/useReducedMotion.ts)), plus toggleable Web Audio API tactile UI sound effects ([`soundEngine.ts`](src/lib/soundEngine.ts)).

---

## Autonomous CMO Decision Deck & Judge Demo Scenarios

[`AutonomousCmoPanel.tsx`](src/components/AutonomousCmoPanel.tsx) guides astronauts through four structured clinical steps:

1. **`1. Triage`** — Radial `0–100` Readiness gauge, BioTwin sensitivity scaling badge, Earth-vs-Space baseline explanation, and Domino Cascade mechanism breakdown.
2. **`2. Exam`** — Offline self-exam protocol cards (*Normal Observation* vs. *Escalation Trigger*), including an interactive **Amsler Grid** visual distortion test and **ONSD Ocular Ultrasound Caliper** (`<= 5.0 mm` optic nerve sheath cutoff) on Neuro-Ocular exams.
3. **`3. Act`** — Executable countermeasures with real-time **PK/PD predicted Readiness/score deltas** and crew-specific drug contraindication warnings.
4. **`4. Link`** — Asynchronous Delay Tolerant Networking (DTN) Flight Surgeon telemetry packet builder with clipboard export and queued handoff state.

### Built-In Judge Demo Scenarios (`DEMO_SCENARIOS`)

| Scenario ID | Title | Environment | Trigger & Multi-Organ Cascade Demonstrated |
| :--- | :--- | :--- | :--- |
| `nominal` | **Nominal ISS Routine** | `iss_orbit` | CO₂ `2.8 mmHg`, hydration `2,550 mL`, ARED complete — all 6 systems nominal |
| `sans_co2_fluid_shift` | **Fluid Shift + CO2 (SANS)** | `iss_orbit` | BP `138/88 mmHg`, CO₂ `4.2 mmHg`, blurry near vision → `gravity_fluid_sans` |
| `renal_dehydration` | **Bone Ca2+ -> Renal Stone** | `mars_transit` (`14m 20s` delay) | Missed ARED + hydration `1,200 mL` + sleep `5.7h` → `bone_calcium_renal` autonomous alert |
| `solar_storm` | **Solar Particle Event (X-Flare)** | `lunar_rover` (`0.16g`) | X-class flare (`3.2 mSv/day`) + sleep `5.8h` + temp `37.9 °C` → `radiation_sleep_immune` |

---

## Hardware Bridge, Live Space Data & Open Twin APIs

### Telemetry Multiplexer & Hardware Bridge ([`HardwareBridgeDrawer.tsx`](src/components/HardwareBridgeDrawer.tsx))
- **Three Multiplexer Modes** ([`telemetryMultiplexer.ts`](src/lib/telemetryMultiplexer.ts)): `preset` (**Sim Preset**), `live_hardware` (**Live Hardware**), and `hybrid_overlay` (**Hybrid Fault Overlay**, injecting cabin/radiation faults atop live hardware readings).
- **Four Physiological Bridge Adapters** ([`biometricBridge.ts`](src/lib/biometricBridge.ts)):
  - **CSA Astroskin** (`1 Hz` continuous biometric garment adapter)
  - **Web Bluetooth GATT** (`0x180D` Heart Rate Service / `0x2A37` measurement stream)
  - **Webcam rPPG** (green-channel optical DFT pulse extraction)
  - **Hardware HTTP Ingest** (`GET`/`POST /api/telemetry`, protocol `NASA-CHP-IDA-1.0`)
- **Live Orbital, Space Weather & OSDR Feeds:**
  - Live ISS orbital coordinates, illumination, South Atlantic Anomaly (SAA) proton belt status, and ETHOS CO₂ metrics via WhereTheISS with deterministic offline fallback ([`issLiveTelemetry.ts`](src/lib/issLiveTelemetry.ts)).
  - Live **NASA DONKI** solar flare sync (`DEMO_KEY` or custom key via `NEXT_PUBLIC_NASA_API_KEY`) and **NASA OSDR** study metadata lookup with curated fallback records (`OSD-48`, `OSD-104`, `OSD-255`, `OSD-530`, `OSD-135`, `OSD-37`).
- **14-Sol Trends & Countermeasure Routine:** Recharts 14-Sol charts ([`TelemetryCharts.tsx`](src/components/TelemetryCharts.tsx)) covering `Crew Vitals`, `OSDR EDA · CO2`, and `RadLab · Dose`, plus a `localStorage`-persisted daily Sol routine & XP tracker ([`RoutineGamificationBar.tsx`](src/components/RoutineGamificationBar.tsx), [`routineStorage.ts`](src/lib/routineStorage.ts)).

### Pre-Flight BioTwin Profiles & REST Endpoints
- **Built-in Crew Profiles (`DEFAULT_CREW_PROFILES`):**
  - `ARES-1` — **Cmdr. Elena Vance**
  - `ARES-2` — **Dr. Marcus Chen** *(hypercalciuric stone risk & CO₂ reactivity demo profile)*
  - `ARES-3` — **Spec. Aria Korolev**
- **Three Dual-Inference Modes (`/preflight`):**
  - `local_mechanistic` — Zero-network onboard BioTwin & Triage Engine (communication-blackout safe).
  - `local_ollama_llm` — Connects to a local Ollama / LM Studio instance on `localhost`.
  - `open_api` — Uses `/api/twin-simulate` or a user-supplied OpenAI-compatible browser endpoint (API Bearer keys are kept strictly in browser `sessionStorage`; server routes ignore external URL fields to prevent SSRF).
- **HTTP Endpoints:**
  - `GET / POST /api/telemetry` ([`route.ts`](src/app/api/telemetry/route.ts)) — Hardware ingest buffer implementing `NASA-CHP-IDA-1.0`.
  - `GET / POST / OPTIONS /api/twin-simulate` ([`route.ts`](src/app/api/twin-simulate/route.ts)) — Implements `ARES-TWIN/1.0 (NASA SSM · SMO 016E · SOMA-informed)` with `64 KB` body cap, CORS headers, strict `400` / `404` / `413` / `422` validation, and zero server-side outbound URL forwarding.

<details>
<summary>Example: Simulating Acetazolamide contraindication on <code>ARES-2 Dr. Marcus Chen</code> via <code>POST /api/twin-simulate</code></summary>

```bash
curl -s -X POST http://localhost:3000/api/twin-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": "ares_2_chen",
    "envId": "iss_orbit",
    "actionId": "neuro_acetazolamide_rx"
  }'
```

</details>

---

## Tech Stack

- **Framework & UI:** Next.js `^15.1.0` (App Router) · React `^19.0.0` · TypeScript `^5.7.2` · Tailwind CSS `^4.0.0`
- **3D Rendering:** Three.js `^0.187.0` (`GLTFLoader`, `OrbitControls`, `EffectComposer`, `UnrealBloomPass`, custom Fresnel/vascular GLSL shaders)
- **Data Viz & Icons:** Recharts `^2.15.0` · Lucide React `^0.468.0`
- **Testing:** Vitest `^2.1.8` (`15` unit, shader-containment, and API contract test suites)
- **3D Asset Pipeline:** Python 3 + headless Blender ([`scripts/fetch_opensource_anatomy.py`](scripts/fetch_opensource_anatomy.py), [`scripts/build_biotwin_glb.py`](scripts/build_biotwin_glb.py))

---

## Repository Structure

```text
├── docs/
│   ├── design-reference/              # 3D briefing architecture notes & coordinate references
│   └── superpowers/                   # Domain design specification & implementation plan
├── public/models/
│   ├── ares-biotwin.glb               # Compiled BioTwin shell, skeleton & 25 organs (~12.0 MB)
│   ├── ares-logo.glb                  # 3D ARES-MED insignia (~52 KB)
│   └── skeleton.glb                   # Clavicle & upper-limb skeletal framing (~5.2 MB)
├── scripts/
│   ├── fetch_opensource_anatomy.py    # Fetches NIH/HuBMAP Visible Human Male CC-BY 4.0 GLBs
│   └── build_biotwin_glb.py           # Headless Blender assembly & containment build script
├── src/
│   ├── app/
│   │   ├── api/telemetry/route.ts     # NASA-CHP-IDA-1.0 hardware telemetry endpoint
│   │   ├── api/twin-simulate/route.ts # ARES-TWIN/1.0 REST simulation & PK/PD endpoint
│   │   ├── preflight/page.tsx         # Pre-Flight Biological Twin Lab & Inference Engine
│   │   ├── layout.tsx                 # Root Next.js layout & styling
│   │   └── page.tsx                   # 3D Briefing (/) & CMO Console (/?mode=console)
│   ├── components/
│   │   ├── AmbientField.tsx           # 3D orbital constellation starfield canvas
│   │   ├── AresLogo3D.tsx             # 3D rotating orbital emblem canvas
│   │   ├── AutonomousCmoPanel.tsx     # 4-stage Triage / Exam (Amsler+ONSD) / Act / Link UI
│   │   ├── BioTwin3DStage.tsx         # Three.js BioTwin renderer, shaders & raycasting
│   │   ├── BioTwinBodyMap.tsx         # 3x2 organ selector + 3D/2D viewport & Domino feed
│   │   ├── HardwareBridgeDrawer.tsx   # Multiplexer, BLE/Astroskin/rPPG, ISS & OSDR drawer
│   │   ├── PresentationStory.tsx      # 7-chapter circular scroll story & SVG callouts
│   │   ├── PresentationView.tsx       # Briefing surface shell, keyboard/drag & transitions
│   │   ├── RoutineGamificationBar.tsx # Countermeasure Sol streak, XP & drawer
│   │   ├── TelemetryCharts.tsx        # 14-Sol Recharts Crew, OSDR CO2 & RadLab trends
│   │   └── VitalsInputPanel.tsx       # 6-channel biometric steppers & mini sparklines
│   ├── data/
│   │   ├── nasaHrpData.ts             # Hazards, environments, 6 systems, scenarios, OSDR, crew
│   │   ├── presentationSlides.ts      # 7 orbital briefing chapter configurations
│   │   ├── developers.ts              # Team credits displayed on chapter 01
│   │   └── __tests__/                 # Dataset invariant tests
│   ├── hooks/
│   │   └── useReducedMotion.ts        # OS & manual reduced-motion state hook
│   ├── lib/
│   │   ├── biometricBridge.ts         # CSA Astroskin, Web BLE GATT, rPPG & HTTP adapters
│   │   ├── briefingPath.ts            # Circular camera/opacity interpolation spline
│   │   ├── clinicalThresholds.ts      # SMO 016E / SOMA thresholds & biological schema
│   │   ├── constellationField.ts      # Procedural starfield particle geometry
│   │   ├── crewProfileStorage.ts      # Browser profile persistence helpers
│   │   ├── issLiveTelemetry.ts        # WhereTheISS + SAA proton belt + ETHOS fallback
│   │   ├── nasaApi.ts                 # NASA DONKI flare client with offline fallback
│   │   ├── presentationMotion.ts      # Scroll velocity & snap timing curves
│   │   ├── routineStorage.ts          # Countermeasure XP & Sol streak persistence
│   │   ├── shellContainment.ts        # Organ bounding containment inside Outer_Body_Shell
│   │   ├── soundEngine.ts             # Web Audio UI SFX synthesizer
│   │   ├── telemetryMultiplexer.ts    # Preset / Live Hardware / Hybrid Fault multiplexer
│   │   ├── triageEngine.ts            # 6-system assessment, 5 cascades & Readiness score
│   │   ├── twinEngine.ts              # Sensitivity multipliers & PK/PD drug simulator
│   │   └── __tests__/                 # 14 core engine, containment, motion & API test suites
│   └── types/
│       └── health.ts                  # Shared TypeScript clinical, cascade & bridge types
├── meta.json                          # NASA Open Source project metadata
├── next.config.ts                     # Configures ARES_BUILD_DIR distDir & devIndicators
└── LICENSE                            # MIT License

```

---

## Local Setup & Verification

### Prerequisites
- **Node.js 20+** and **npm**
- *(Optional)* **Python 3** + **Blender** if regenerating [`public/models/ares-biotwin.glb`](public/models/ares-biotwin.glb) from NIH/HuBMAP reference meshes
- *(Optional)* `NEXT_PUBLIC_NASA_API_KEY` in `.env.local` for higher-quota NASA DONKI solar telemetry (defaults to `DEMO_KEY` with deterministic offline fallback)

### Run Locally
```bash
git clone https://github.com/Mottii/astronaut-health-monitor.git
cd astronaut-health-monitor
npm install
npm run dev
```

Open in your browser:
- `http://localhost:3000` — **3D Orbital Briefing** (7-chapter presentation)
- `http://localhost:3000/?mode=console` — **Autonomous CMO Clinical Console**
- `http://localhost:3000/preflight` — **Pre-Flight Biological Twin Lab**

### Type-Check, Tests & Production Builds
```bash
# TypeScript type-check (tsc --noEmit)
npm run lint

# Vitest unit, containment & API contract suite (15 test files)
npm test

# Standard production build (.next)
npm run build
npm start

# Isolated production build directory (configured via next.config.ts)
ARES_BUILD_DIR=.next-production npm run build
```

---

## Official Data & Research Citations

- **NASA Human Research Program (HRP) — 5 Hazards of Human Spaceflight:** <https://www.nasa.gov/hrp/hazards/>
- **NASA Open Science Data Repository (OSDR) — `OSD-48`, `OSD-104`, `OSD-255`, `OSD-530`, `OSD-135`, `OSD-37`:** <https://osdr.nasa.gov/>
- **NASA Spaceflight Standard Measures (SMO 016E) & Space Omics and Medical Atlas (SOMA)**
- **NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information):** <https://api.nasa.gov/>
- **Canadian Space Agency (CSA) — Astroskin Bio-Monitor & Radi-N2 / RadLab:** <https://www.asc-csa.gc.ca/eng/sciences/astroskin.asp>
- **NIH / HuBMAP Human Reference Atlas — Visible Human Male (CC-BY 4.0):** 25 anatomical organ `.glb` reference meshes assembled into `ares-biotwin.glb`

---

## License

Released under the [MIT License](LICENSE). See [`meta.json`](meta.json) for open-source repository metadata.

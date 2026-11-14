# ARES-MED OS — Astronaut Health Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ARES-MED OS, an autonomous astronaut health monitoring, BioTwin organ-cascade visualization, and guided crew medical triage web application grounded in NASA HRP, OSDR EDA/RadLab, CSA radiation guidance, and live NASA DONKI space weather data.

**Architecture:** A single-page Next.js App Router + TypeScript client application organized around three data layers: (1) habitat/space-weather environment telemetry (`iss_orbit`, `lunar_rover`, `mars_transit`, `mars_base`) with NASA DONKI API + offline OSDR fallback, (2) personal crew vitals and self-exam observations, and (3) a pure deterministic Space-Medicine Triage & Organ Cascade engine driving an interactive SVG anatomical body map, Recharts 14-Sol telemetry charts, and a 3-step Autonomous CMO decision workflow.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, `lucide-react`, `recharts`, `vitest`.

**Spec:** [2026-11-14-astronaut-health-monitor-design.md](../specs/2026-11-14-astronaut-health-monitor-design.md)

## Global Constraints

- Zero paid external APIs, zero backend database, and zero login/auth screens (100% instant demo usability).
- Follow `github.com/nasa/instructions`: no large binary files or Git LFS; maintain root `meta.json`, `LICENSE`, and clear `README.md`.
- Every health metric and organ view must explicitly contrast **Earth Normal Baseline** vs. **Spaceflight-Adjusted Baseline** and reference official NASA HRP risks or OSDR/CSA resources.
- All user inputs must be strictly validated/clamped so extreme or `NaN` values never crash rendering or scoring.

## Review Focus

- Out-of-bounds, negative, or `NaN` vital inputs (e.g., `-10` HR or `NaN` glucose) must clamp safely within physiological engine bounds without producing `NaN` readiness scores.
- NASA DONKI API timeout (`> 3500ms`), HTTP `429` rate limit, or offline failure must seamlessly fall back to curated OSDR RadLab/EDA solar telemetry with an explicit `"Offline / Curated OSDR Fallback"` status badge.
- Switching between `iss_orbit`, `lunar_rover`, `mars_transit`, and `mars_base` must immediately recalculate organ triage statuses, comm-delay escalation mode, and active organ cascades.
- Checking/unchecking a daily routine task must update XP and completion state idempotently without double-counting points.
- Empty or corrupted JSON in `localStorage` for routine progress/saved logs must recover cleanly to default nominal state without throwing runtime errors.

---

### Task 1: Project Scaffolding & NASA HRP / OSDR Reference Dataset

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/types/health.ts`
- Create: `src/data/nasaHrpData.ts`

**Interfaces:**
- Produces in `src/types/health.ts`:
  - `MissionEnvironmentId = 'iss_orbit' | 'lunar_rover' | 'mars_transit' | 'mars_base'`
  - `BodySystemId = 'neuro_ocular' | 'cardiovascular' | 'musculoskeletal_renal' | 'metabolic_endocrine' | 'immune_hematology' | 'behavioral_circadian'`
  - `HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'closed_env'`
  - `TriageStatus = 'green' | 'amber' | 'red'`
  - `OcularFinding = 'clear' | 'blurry_near' | 'visual_halos'`
  - `SolarFlareClass = 'None' | 'C' | 'M' | 'X'`
  - `VitalReadings`, `EnvironmentTelemetry`, `MissionEnvironmentConfig`, `BodySystemMetadata`, `CascadeLink`, `SystemAssessment`, `HealthEvaluationResult`, `MissionScenario`, `RoutineTask`, `SolTelemetryPoint`
- Produces in `src/data/nasaHrpData.ts`:
  - `MISSION_ENVIRONMENTS: Record<MissionEnvironmentId, MissionEnvironmentConfig>`
  - `BODY_SYSTEM_METADATA: Record<BodySystemId, BodySystemMetadata>`
  - `DEMO_SCENARIOS: MissionScenario[]` (4 scenarios: `nominal`, `solar_storm`, `sans_co2_fluid_shift`, `renal_dehydration`)
  - `DEFAULT_ROUTINE_TASKS: RoutineTask[]`
  - `BASE_14_SOL_HISTORY: Record<MissionEnvironmentId, SolTelemetryPoint[]>`

- [x] **Step 1: Initialize Next.js + TypeScript + Tailwind + Recharts + Lucide + Vitest workspace**
  Run `npx` or `npm init` + install dependencies (`next`, `react`, `react-dom`, `lucide-react`, `recharts`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `tailwindcss`, `@tailwindcss/postcss`, `vitest`, `@vitejs/plugin-react`). Configure `package.json` scripts (`dev`, `build`, `start`, `lint`, `test`), `vitest.config.ts`, `tsconfig.json` (with `@/*` path alias), `next.config.ts`, `postcss.config.mjs`, and `src/app/globals.css` + `src/app/layout.tsx`.
- [x] **Step 2: Define domain types in `src/types/health.ts`**
  Define all exported union types and interfaces listed in Interfaces above, including `EarthVsSpaceRange` (storing `earthRange: string`, `spaceRange: string`, `unit: string`) and `SelfExamStep` (`stepNumber`, `instruction`, `targetOutcome`).
- [x] **Step 3: Author curated NASA HRP, OSDR & CSA reference data in `src/data/nasaHrpData.ts`**
  Populate all 4 environments, 6 body systems (each with HRP risk summary, OSDR Study ID citation e.g. `OSD-48`, CSA reference where applicable, 3 plain-language self-exam steps, crew countermeasure actions, and flight surgeon escalation triggers), 4 demo scenarios, 5 daily routine tasks, and 14-Sol EDA/RadLab trend history arrays.
- [x] **Step 4: Verify TypeScript compilation & Vitest runner**
  Run: `npx tsc --noEmit && npx vitest run` (expect `tsc` exits 0).
- [x] **Step 5: Commit**
  ```bash
  git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts src/
  git commit -m "chore: scaffold Next.js TypeScript app with NASA HRP and OSDR reference data"
  ```

---

### Task 2: Space-Medicine Triage & Organ Cascade Engine

**Files:**
- Create: `src/lib/triageEngine.ts`
- Test: `src/lib/__tests__/triageEngine.test.ts`

**Interfaces:**
- Consumes: `src/types/health.ts`, `MISSION_ENVIRONMENTS` and `BODY_SYSTEM_METADATA` from `src/data/nasaHrpData.ts`.
- Produces in `src/lib/triageEngine.ts`:
  - `clampVitalReadings(vitals: VitalReadings): VitalReadings`
  - `evaluateCrewHealth(vitals: VitalReadings, envTelemetry: EnvironmentTelemetry, envId: MissionEnvironmentId): HealthEvaluationResult`
  - `formatFlightSurgeonPacket(evaluation: HealthEvaluationResult, vitals: VitalReadings, envTelemetry: EnvironmentTelemetry, envId: MissionEnvironmentId): string`

- [x] **Step 1: Write failing unit tests in `src/lib/__tests__/triageEngine.test.ts`**
  Test cases to assert:
  1. `nominal` scenario in `iss_orbit` yields all 6 systems `green`, `activeCascades.length === 0`, and `readinessScore >= 85`.
  2. `sans_co2_fluid_shift` scenario (`iss_orbit`, BP `138/88`, Cabin $\text{CO}_2$ `4.2 mmHg`, ocular `blurry_near`) triggers `gravity_fluid_sans` cascade (`cardiovascular` -> `neuro_ocular`) and elevates `neuro_ocular` to `red`.
  3. `renal_dehydration` scenario (`mars_transit`, Hydration `1200 mL`) triggers `bone_calcium_renal` cascade and marks `musculoskeletal_renal` as `red`.
  4. `solar_storm` scenario (`lunar_rover`, Radiation `3.2 mSv/day`, Solar Flare `'X'`, Sleep `5.8 hrs`) triggers `radiation_sleep_immune` cascade (`behavioral_circadian` -> `immune_hematology`) and marks `immune_hematology` as `red`.
  5. `stress_glucose_metabolic` triggers when Sleep `5.5 hrs`, Mood `3`, and Blood Glucose `128 mg/dL`.
  6. Clamping & edge cases: `NaN` or negative inputs (e.g., `heartRate: -20`, `bloodGlucoseMgDl: NaN`, `sleepHours: 99`) are clamped safely and never return `NaN` in `readinessScore` or `clampedVitals`.
  7. Environment sensitivity: identical borderline readings (`hydrationMl: 2050`, `dailyRadiationMsv: 1.3`) produce higher risk / `autonomousTriageRequired: true` under `mars_transit` (14m 20s comm delay, `0g`) compared to `iss_orbit`.
- [x] **Step 2: Run tests to verify they fail**
  Run: `npx vitest run src/lib/__tests__/triageEngine.test.ts` -> Expected: FAIL (module not found).
- [x] **Step 3: Implement `clampVitalReadings`, `evaluateCrewHealth`, and `formatFlightSurgeonPacket` in `src/lib/triageEngine.ts`**
  Implement deterministic Space-Medicine scoring using Earth-vs-Space baseline comparisons, all 4 cascade rules, readiness score deductions (`-18` per `red`, `-7` per `amber`, `-5` per active cascade, clamped `0–100`), and Flight Surgeon escalation logic factoring in environment communication delay.
- [x] **Step 4: Run tests to verify they pass**
  Run: `npx vitest run src/lib/__tests__/triageEngine.test.ts` -> Expected: PASS (all 7 tests green).
- [x] **Step 5: Commit**
  ```bash
  git add src/lib/triageEngine.ts src/lib/__tests__/triageEngine.test.ts
  git commit -m "feat: add Space-Medicine triage and multi-organ cascade engine with tests"
  ```

---

### Task 3: NASA Live Space Weather & OSDR RadLab/EDA Telemetry Service

**Files:**
- Create: `src/lib/nasaApi.ts`
- Test: `src/lib/__tests__/nasaApi.test.ts`

**Interfaces:**
- Consumes: `SolarFlareClass`, `EnvironmentTelemetry` from `src/types/health.ts`.
- Produces in `src/lib/nasaApi.ts`:
  - `SpaceWeatherStatus` interface (`source: 'nasa_donki_live' | 'osdr_radlab_fallback'`, `flareClass: SolarFlareClass`, `peakTime: string`, `recommendedDoseModifierMsv: number`, `summary: string`, `isFallback: boolean`)
  - `parseDonkiFlareClass(classType?: string): SolarFlareClass`
  - `fetchSpaceWeatherAlert(fetchImpl?: typeof fetch): Promise<SpaceWeatherStatus>`

- [x] **Step 1: Write failing tests in `src/lib/__tests__/nasaApi.test.ts`**
  Test cases to assert:
  1. `parseDonkiFlareClass('M3.4')` returns `'M'`; `'X1.2'` returns `'X'`; `'C2.1'` returns `'C'`; undefined/empty returns `'None'`.
  2. Mocked `fetchImpl` returning a DONKI array with `[{ classType: 'M4.2', peakTime: '2026-11-14T03:15Z' }]` resolves with `source: 'nasa_donki_live'`, `flareClass: 'M'`, `isFallback: false`, and `recommendedDoseModifierMsv > 0`.
  3. Mocked `fetchImpl` returning HTTP `429` or rejecting with network timeout error resolves gracefully (never rejects) with `source: 'osdr_radlab_fallback'` and `isFallback: true`.
  4. Mocked `fetchImpl` returning empty JSON `[]` resolves with `source: 'nasa_donki_live'`, `flareClass: 'None'`, `recommendedDoseModifierMsv: 0`.
- [x] **Step 2: Run tests to verify they fail**
  Run: `npx vitest run src/lib/__tests__/nasaApi.test.ts` -> Expected: FAIL.
- [x] **Step 3: Implement `parseDonkiFlareClass` and `fetchSpaceWeatherAlert` in `src/lib/nasaApi.ts`**
  Query `https://api.nasa.gov/DONKI/FLR` (last 7 days, `api_key=DEMO_KEY`) with `AbortController` timeout (`3500ms`), parse strongest recent flare class (`X > M > C > None`), and return deterministic OSDR RadLab fallback metadata on error/timeout.
- [x] **Step 4: Run tests to verify they pass**
  Run: `npx vitest run src/lib/__tests__/nasaApi.test.ts` -> Expected: PASS.
- [x] **Step 5: Commit**
  ```bash
  git add src/lib/nasaApi.ts src/lib/__tests__/nasaApi.test.ts
  git commit -m "feat: add NASA DONKI live space weather service with OSDR fallback"
  ```

---

### Task 4: Interactive BioTwin Body Map, Vitals Input & Telemetry Charts

**Files:**
- Create: `src/components/BioTwinBodyMap.tsx`
- Create: `src/components/VitalsInputPanel.tsx`
- Create: `src/components/TelemetryCharts.tsx`

**Interfaces:**
- Consumes: Types from `src/types/health.ts`, metadata from `src/data/nasaHrpData.ts`.
- Produces:
  - `BioTwinBodyMap({ assessments, cascades, selectedSystem, onSelectSystem })`
  - `VitalsInputPanel({ vitals, envTelemetry, envId, onUpdateVitals, onUpdateEnvTelemetry })`
  - `TelemetryCharts({ history, currentVitals, currentEnvTelemetry, envId })`

- [x] **Step 1: Build `src/components/BioTwinBodyMap.tsx`**
  Create an interactive NASA Open MCT-styled SVG human figure displaying all 6 anatomical nodes (`neuro_ocular`, `cardiovascular`, `musculoskeletal_renal`, `metabolic_endocrine`, `immune_hematology`, `behavioral_circadian`) with status colors (`green` emerald, `amber` gold, `red` crimson + pulse ring), clickable hit areas (`aria-pressed`, keyboard focusable), animated SVG `<path>` cascade lines connecting triggered organs, and an active cascade callout strip underneath.
- [x] **Step 2: Build `src/components/VitalsInputPanel.tsx`**
  Create clean dark-telemetry controls for all 7 challenge prompt indicators (`bloodPressureSystolic`/`Diastolic`, `heartRateBpm`, `bloodGlucoseMgDl`, `bodyTempC`, `sleepHours`, `moodScore`, `hydrationMl`), plus `ocularFinding` selector (for SANS / ultrasound eye check) and `cabinCo2MmHg` / `dailyRadiationMsv` habitat controls. Show an explicit **Earth Normal vs. Spaceflight Normal** badge next to each indicator.
- [x] **Step 3: Build `src/components/TelemetryCharts.tsx`**
  Use `recharts` (`ResponsiveContainer`, `ComposedChart`, `Line`, `Area`, `ReferenceArea`, `XAxis`, `YAxis`, `Tooltip`) with tab switching between: (a) **Physiological Vitals (HR, Glucose, Sleep)** overlaid with Spaceflight vs. Earth normal zones, and (b) **NASA OSDR EDA & RadLab Habitat Telemetry (Cabin $\text{CO}_2$ ISS vs. Ground Control + GCR/SAA Daily Radiation)**.
- [x] **Step 4: Verify TypeScript compilation**
  Run: `npx tsc --noEmit` -> Expected: exits 0.
- [x] **Step 5: Commit**
  ```bash
  git add src/components/BioTwinBodyMap.tsx src/components/VitalsInputPanel.tsx src/components/TelemetryCharts.tsx
  git commit -m "feat: add BioTwin SVG body map, vitals input panel, and Recharts telemetry views"
  ```

---

### Task 5: Autonomous CMO Triage Workflow, Gamification & Main Mission Console

**Files:**
- Create: `src/components/AutonomousCmoPanel.tsx`
- Create: `src/components/RoutineGamificationBar.tsx`
- Create: `src/lib/routineStorage.ts`
- Test: `src/lib/__tests__/routineStorage.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `evaluateCrewHealth`, `formatFlightSurgeonPacket` (`src/lib/triageEngine.ts`); `fetchSpaceWeatherAlert` (`src/lib/nasaApi.ts`); Task 4 components.
- Produces:
  - `src/lib/routineStorage.ts`: `loadRoutineProgress(storage?: Pick<Storage, 'getItem'>): RoutineProgressState`, `toggleRoutineTask(state: RoutineProgressState, taskId: string): RoutineProgressState`, `saveRoutineProgress(state: RoutineProgressState, storage?: Pick<Storage, 'setItem'>): void`
  - `AutonomousCmoPanel({ selectedSystem, evaluation, vitals, envTelemetry, envId })`
  - `RoutineGamificationBar({ tasks, progress, onToggleTask, onResetDay })`
  - Complete Mission Console in `src/app/page.tsx`

- [x] **Step 1: Write failing test for `routineStorage.ts` in `src/lib/__tests__/routineStorage.test.ts`**
  Assert:
  1. Empty or corrupted `localStorage` JSON returns clean default state (`completedTaskIds: []`, `xp: 0`, `streakSols: 12`).
  2. `toggleRoutineTask` adds XP once on check and removes XP idempotently on uncheck (never double-counts).
- [x] **Step 2: Run test to verify it fails, implement `src/lib/routineStorage.ts`, and re-run to verify PASS**
  Run: `npx vitest run src/lib/__tests__/routineStorage.test.ts` -> Expected: PASS.
- [x] **Step 3: Build `src/components/AutonomousCmoPanel.tsx` & `src/components/RoutineGamificationBar.tsx`**
  - `AutonomousCmoPanel`: Displays the selected system's triage status, NASA HRP Risk title + OSDR study accession badge (`OSD-48`, etc.), interactive 3-step **Guided Self-Exam Checklist** (*Why this exam is needed* -> *How to measure in space* -> *Immediate Crew Countermeasures*), and a **Flight Surgeon Escalation / Telemetry Packet** button with copy-to-clipboard (showing comm delay warning when in `mars_transit` or `mars_base`).
  - `RoutineGamificationBar`: Displays Sol Streak, XP level badge, and interactive mission routine checkboxes.
- [x] **Step 4: Wire full console in `src/app/page.tsx` and update `README.md`**
  - `src/app/page.tsx`: Top Mission Bar (Environment switcher, Live NASA DONKI solar weather sync pill with fallback indicator, Mission Readiness Score, 4 Demo Scenario presets), 3-column workspace (`BioTwinBodyMap` | `VitalsInputPanel` + `TelemetryCharts` | `AutonomousCmoPanel` + `RoutineGamificationBar`), and footer citing all 5 official challenge resources.
  - `README.md`: Update with screenshots/architecture summary, local run commands (`npm install`, `npm run dev`, `npm test`), and complete NASA/CSA/OSDR/DONKI citations.
- [x] **Step 5: Run full verification suite & production build**
  Run: `npx vitest run && npx tsc --noEmit && npm run build` -> Expected: all tests pass, zero TypeScript errors, Next.js build succeeds cleanly.
- [x] **Step 6: Commit**
  ```bash
  git add src/ README.md
  git commit -m "feat: integrate Autonomous CMO triage console, gamified routine, and mission dashboard"
  ```

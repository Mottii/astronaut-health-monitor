# ARES-MED OS (`astronaut-health-monitor`)

> **2026 NASA International Space Apps Challenge — Almaty Local Event**
> **Challenge:** [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)

**ARES-MED OS** is an autonomous astronaut health monitoring, multi-organ physiological cascade mapping, and Chief Medical Officer (CMO) guided triage console built for orbital stations, lunar rovers, deep-space Mars transit vehicles, and planetary surface habitats.

---

## Why ARES-MED OS Exists

On deep-space missions (such as Mars Transit with `14m 20s` one-way light delay or Mars Surface Base with `18m 40s`), crew members cannot wait 30–40 minutes for ground Flight Surgeon confirmation during acute medical events—and Earth "normal" clinical thresholds fail in altered gravity, elevated closed-cabin $\text{CO}_2$, and elevated GCR/SPE radiation.

**ARES-MED OS** combines **3 integrated layers**:
1. **BioTwin Multi-Organ Cascade Map ([BioTwinBodyMap.tsx](src/components/BioTwinBodyMap.tsx)):** Interactive dark-mode SVG anatomy map linking physiological vitals (`HR`, `BP`, `Glucose mg/dL`, `Body Temp °C`, `Sleep`, `Mood`, `Hydration mL`, `Ocular/Ultrasound findings`, `ARED completion`) and environmental telemetry (`Cabin CO₂ mmHg`, `mSv/day`) to **4 clinically grounded multi-organ cascades** (e.g., *Microgravity Fluid Shift + CO₂ → SANS*, *Bone Calcium Mobilization + Dehydration → Renal Stone*, *Solar Particle Event + Sleep Debt → Immune Reactivation*, *Isolation Stress → Glucose / Metabolic Drift*).
2. **Autonomous Chief Medical Officer (CMO) Guided Triage ([AutonomousCmoPanel.tsx](src/components/AutonomousCmoPanel.tsx)):** Displays the active NASA HRP Risk, clickable **NASA OSDR** study accessions (`OSD-48`, `OSD-255`, `OSD-37`, `OSD-104`, `OSD-570`, `OSD-530`), *Why This Exam Matters in Spaceflight* clinical rationale, an interactive **3-Step Guided Self-Exam Checklist**, immediate countermeasures, and a one-click **Flight Surgeon Telemetry Packet** generator.
3. **Gamified Countermeasure Routine & Live Space Weather ([RoutineGamificationBar.tsx](src/components/RoutineGamificationBar.tsx) & [nasaApi.ts](src/lib/nasaApi.ts)):** Persistent `localStorage` Sol Streak & XP tracking (`ared_load`, `amsler_ocular`, `renal_hydration`, `radlab_sync`, `circadian_ssla`) paired with live **NASA DONKI** solar flare polling (`3500ms` timeout + automatic fallback to curated **OSDR RadLab** SPE storm data).

---

## Earth Normal vs. Spaceflight Adjusted Normal (Built Into Every Metric)

| Telemetry Indicator | Earth Sea-Level Normal | Spaceflight Adjusted Normal | Physiological Rationale |
| :--- | :--- | :--- | :--- |
| **Resting Heart Rate** | `60–100 bpm` | `55–78 bpm` (LEO) | Microgravity baroreceptor resetting lowers supine/orbital resting HR; bradycardia or postural tachycardia spikes indicate autonomic/fluid stress. |
| **Blood Pressure** | `110–120 / 70–80 mmHg` | `105–128 / 68–84 mmHg` | ~2 L cephalad blood volume shift alters arterial compliance despite 10–15% plasma volume contraction. |
| **Cabin $\text{CO}_2$ (`OSDR EDA`)** | `0.3 mmHg` (`~400 ppm`) | `<= 3.0 mmHg` (`~3,950 ppm`) | Closed-loop ECLSS scrubber load runs ~10× Earth ambient $\text{CO}_2$, triggering headaches and compounding SANS intracranial pressure. |
| **Radiation (`RadLab` / `CSA`)** | `0.008 mSv/day` | `0.5 LEO / 1.8 Deep Space mSv/day` | GCR + SAA trapped protons + Solar Particle Events accelerate immune reactivation and DNA damage. |
| **Daily Hydration** | `>= 2,000 mL/day` | `>= 2,400 mL/day` | Offsets osteoclastic urinary calcium surges to prevent incapacitating renal stones (`OSD-37` / `OSD-48`). |

---

## Quickstart & Verification

### Prerequisites
- Node.js `>= 20` and `npm`

### Local Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Automated Tests & Production Build
```bash
npm test          # Vitest unit tests (NASA dataset, triage cascades, DONKI fallback, 14-Sol series, routine storage)
npx tsc --noEmit  # TypeScript strict type checking
npm run build     # Next.js 15 production bundle build
```

---

## Judge Demo Walkthrough (One-Click Scenarios)

In the top command bar, switch instantly between **4 pre-configured mission scenarios**:
1. **Nominal ISS Routine (`iss_orbit`):** Baseline 0g LEO operation with `OSDR EDA` cabin $\text{CO}_2 \le 3.0\text{ mmHg}$, proper hydration (`2,550 mL`), and ARED exercise completed (`Readiness` in Green / Nominal).
2. **Fluid Shift + $\text{CO}_2$ (SANS) (`iss_orbit`):** Elevated cabin $\text{CO}_2$ (`4.2 mmHg`) + blurry near vision triggers the **Cardiovascular → Neuro-Ocular SANS Cascade** and highlights the Optic Nerve Sheath Ultrasound Protocol.
3. **Bone $\text{Ca}^{2+}$ → Renal Stone (`mars_transit`):** `14m 20s` one-way comm delay triggers **Autonomous CMO Mode**; missed ARED + dehydration (`1,200 mL`) lights up the **Musculoskeletal/Renal** cascade and generates an urgent Flight Surgeon Telemetry Packet.
4. **Solar Particle Event (X-Flare) (`lunar_rover`):** `3.2 mSv/day` radiation burst combined with sleep debt triggers the **Immune & Hematology Cascade** (`OSD-530`). Click **Sync Live NASA DONKI** to test live space-weather ingestion or automatic **OSDR RadLab** fallback.

---

## Official NASA, CSA & Open-Source Citations

- **NASA Human Research Program (HRP) — 5 Hazards of Human Spaceflight:** https://www.nasa.gov/hrp/hazards/
- **NASA Human Research Program (HRP) — Risks of Human Spaceflight:** https://www.nasa.gov/hrp/risks/
- **NASA Human Research Program (HRP) — Ongoing HRP Research in Space:** https://www.nasa.gov/hrp/ongoing-hrp-research/
- **Canadian Space Agency (CSA) — Monitoring Radiation for Astronaut Health:** https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- **Canadian Space Agency (CSA) — Why Do We Conduct Science Experiments in Space?:** https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
- **NASA Open Science Data Repository (OSDR) / EDA / RadLab:** https://osdr.nasa.gov/bio/repo (`OSD-37`, `OSD-48`, `OSD-104`, `OSD-255`, `OSD-530`, `OSD-570`)
- **NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI):** https://api.nasa.gov/

---

## License

Released under the [MIT License](./LICENSE). Repository metadata follows [NASA Open Source GitHub Guidelines](https://github.com/nasa/instructions) ([meta.json](./meta.json)).

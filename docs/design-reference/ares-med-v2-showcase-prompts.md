# ARES-MED OS — Промпты и архитектура презентации (6 слайдов + 7-й титульник)

Дополнение к [ares-med-cinematic-presentation-prompt.md](ares-med-cinematic-presentation-prompt.md) и [forma-studio-prompts.md](forma-studio-prompts.md).
Цель документа — дать готовые, максимально подробные промпты и архитектурные ориентиры для доработки «лица» проекта (`PresentationView`, `BioTwin3DStage`, переход в `CMO Console`) на уровне передовых интерактивных сайтов (Active Theory, Lusion, Forma Studio, Linear, SpaceX Dragon UI).

---

## 1. Структура: 6 основных слайдов + 7-й титульник проекта

Чтобы презентация работала и как цельная история, и как удобный инструмент на живой защите:

| Экран | Роль | Камера и 3D-слой | Контент и главное действие |
| --- | --- | --- | --- |
| **Титульник (7-й экран / Cover)** | Лицо проекта для жюри и зрителей | Полный рост BioTwin в спокойном медленном вращении, мягкий проход сканирующей плоскости | **ARES-MED OS**, бейдж `NASA Space Apps Challenge 2026 // Almaty`, краткая 3-слойная схема (`BioTwin 3D → Autonomous CMO → NASA OSDR/DONKI`), переключатель звука и две кнопки: `Start 6-Slide Briefing` и `Open CMO Console` |
| **01 — Mission** | Постановка проблемы автономности | Полный рост, ракурс в три четверти, режим `atlas` | Задержка связи в дальнем космосе и отличие космических норм от земных |
| **02 — Neuro-ocular** | Каскад 1: смещение жидкости и $\text{CO}_2$ | Плавный подъём к голове и глазам, режим `xray` + локальное ослабление оболочки | `CO₂` и систолическое давление (`SANS`), выноска к глазам, формула `Exposure → System response → Next check` |
| **03 — Cardiovascular** | Каскад 2: барорецепторы в 0g | Спуск к грудной клетке, режим `vascular`, пульсация сердца в такт ЧСС | `HR` и `BP`, живая ЭКГ-волна в карточке |
| **04 — Renal & Bone** | Каскад 3: потеря кальция и камни в почках | Косой ракурс на поясницу и таз, режим `xray`, подсветка «кость → почки» | Гидратация и статус `ARED`, микро-кнопка симуляции контрмеры («До / После») прямо на слайде |
| **05 — Radiation & Immune** | Каскад 4: солнечная вспышка (SPE) | Отдаление к верхней части тела, редкие направленные частицы радиации | Доза `mSv/day`, температура, кнопка `Sync Live NASA DONKI` |
| **06 — Metabolic & Circadian** | Каскад 5: сбой ритмов и инсулинорезистентность | Спуск к печени и верхней части живота, мини-радар тела в углу | Глюкоза и длительность сна, финальная кнопка бесшовного перехода **`Open Full CMO Console`** |

---

## 2. Ключевые архитектурные корректировки (Frontend)

1. **Единый персистентный WebGL-canvas (`Single-Canvas Architecture`)**
   - Держать `BioTwin3DStage` смонтированным на верхнем уровне `src/app/page.tsx`, а не пересоздавать при переключении `presentation` ↔ `console`.
   - При переходе в `CMO Console` камера и контейнер 3D-модели плавно смещаются в левую колонку, а оверлеи презентации уступают место панелям `AutonomousCmoPanel` и `VitalsInputPanel` без перезагрузки `.glb` и мерцания.
2. **Единая машина состояний переходов (`1.4s` таймлайн)**
   - Один осознанный жест скролла или нажатие клавиши запускает законченный 1400-миллисекундный переход с блокировкой остаточной инерции трекпада.
   - Разделение режимов **`Briefing`** (камера следует за историей) и **`Inspect`** (свободное вращение, ручной переключатель слоёв `Shell / Anatomy / X-ray`, кнопка `Return to briefing`).
3. **Адаптивный GPU-бюджет и `prefers-reduced-motion`**
   - Ограничение `dpr` (до `1.5–2`), опциональное упрощение `UnrealBloomPass` на слабых устройствах.
   - В `reduced-motion`: мгновенный `crossfade` вместо перелёта камеры, отключение параллакса, частиц и декоративного скролл-сканирования.

---

## 3. Подробные промпты для реализации

### Промпт 1 — Boot Sequence, 7-й титульник проекта и Single-Canvas Morph

```text
Upgrade the entry experience and navigation architecture of ARES-MED OS in `src/app/page.tsx`, `src/components/PresentationView.tsx`, and `src/components/BioTwin3DStage.tsx` using a 6-chapter briefing plus a dedicated 7th project title screen.

1. Persistent Single-Canvas Architecture:
Keep `BioTwin3DStage` mounted continuously at the root level in `src/app/page.tsx` across both `presentation` and `console` modes. Never unmount or reload the Three.js WebGLRenderer or `.glb` assets when switching between the title screen, the 6 presentation slides, and the CMO Console. When opening the CMO Console, smoothly interpolate the 3D camera target and viewport framing from the presentation composition to the left-column console layout while fading out presentation HUD overlays and staggering in `AutonomousCmoPanel` and `VitalsInputPanel` over 400ms. Add a compact persistent `[ BRIEFING | CONSOLE ]` switcher in the top bar so the user can return to any slide without losing the active scenario or vitals state.

2. 7th Screen — Project Title Cover (Active Theory / SpaceX Dragon Style):
Design a dedicated project title screen (`ARES-MED OS`) that serves as the flagship cover (accessible as the entry portal or 7th overview slide):
- Background: full-bleed `BioTwin3DStage` in `full` framing, slow orbital rotation, restrained icy-cyan Fresnel rim (`#79D9F2`), subtle vertical scanline pass, and a 3% opacity film-grain overlay.
- Foreground: editorial display typography (Space Grotesk 48–64px) with a single restrained NASA Space Apps Challenge 2026 // Almaty badge in JetBrains Mono, a crisp 3-node architecture strip (`BioTwin 3D → Autonomous CMO → NASA OSDR/DONKI`), a visible audio toggle, and two primary actions: `Start 6-Slide Briefing` (with audio) and `Open CMO Console`.
- Boot Sequence Transition: clicking `Start 6-Slide Briefing` triggers a 900ms iris/horizontal-scanline `clip-path` reveal of the HUD while the 3D camera performs a smooth dolly-in from a wider establishing distance into Slide 01 (`FULL_BODY_VIEW`), accompanied by a single `soundEngine.playCameraWhoosh()`.

3. Unified 1.4s Slide Choreography & Trackpad Guard:
Replace the instant slide swap and 580ms wheel cooldown in `PresentationView.tsx` with a synchronized 1400ms transition controller:
- 0–160ms: outgoing metric cards and SVG leader lines fade out (`opacity 1→0`, `translateY 0→8px`).
- 80–1200ms: 3D camera interpolates along a shallow arc with ease-in-out cubic easing (no spring overshoot); absorb residual trackpad wheel momentum so one deliberate gesture advances exactly one chapter.
- 250–600ms: incoming chapter kicker, headline, and summary reveal smoothly (`opacity 0→1`, `translateY 12px→0`). Do not run `useScrambleText` on every slide headline — keep slide titles immediately legible during transitions and reserve character decoding for the title cover only.
- 600–1200ms: organ highlight, SVG leader line draw, and staggered left telemetry cards (`80ms` stagger).
```

---

### Промпт 2 — Послойное сканирование, локальный X-Ray «фонарик» и SVG-выноски

```text
Enhance `src/components/BioTwin3DStage.tsx` and `src/components/PresentationView.tsx` with Forma Studio-inspired anatomical inspection shaders, spatial orientation aids, and clean 3D-to-2D callouts.

1. Vertical Shader Wipe ("Shell → Skeleton → Organs"):
Extend `FRESNEL_VERTEX_SHADER` and `FRESNEL_FRAGMENT_SHADER` in `BioTwin3DStage.tsx` with a `uScanProgress` uniform. When switching between `atlas`, `xray`, and `vascular` modes across the 6 slides, sweep a thin luminous cyan scan-plane (`#79D9F2`) smoothly across `vWorldPos.y`, peeling the outer translucent shell into the underlying skeletal frame and active organ systems. Keep ambient background scanlines subtle so fine vessels and labels remain razor-sharp.

2. Localized Hover X-Ray Mask & Precision Reticle (Forma Studio / Teenage Engineering):
Pass the 3D raycast intersection point (`uHoverPoint` vec3) and hover intensity (`uHoverStrength` float) into the outer shell shader. Moving the pointer over the astronaut reveals a soft, feathered circular X-ray/wireframe window strictly around the cursor, paired with a custom lightweight inspection reticle (thin crosshair + live structure label + 2–3 corner brackets) that fades out smoothly over 200ms on pointer exit.

3. 3D-to-2D Projected SVG Leader Line & Orientation Radar:
- Leader Line: project the active focal organ's 3D world position (`vector.project(camera)`) into screen coordinates each frame and render a crisp, single-elbow SVG leader line (`stroke-dashoffset` draw animation over 300ms) connecting the glowing organ directly to the active left-side metric card. Automatically hide or reposition the line if it crosses text or leaves safe viewport bounds.
- Orientation Radar (Slides 02–06): on zoomed-in organ chapters, display a minimal 64×120px full-body wireframe silhouette in the bottom-right or left margin with a glowing viewport bracket indicating which anatomical zone the camera is currently inspecting.

4. Briefing vs. Inspect Mode & Restrained Atmosphere:
Keep `Briefing` camera locked to story presets, and allow clicking an `Inspect Structure` pill to unlock OrbitControls + a compact `Shell / Anatomy / X-ray` layer switcher. Replace rotating rings under individual organs with a single subtle elliptical diagnostic floor ring. Keep `UnrealBloomPass` restrained and disable chromatic aberration over DOM typography. Respect `prefers-reduced-motion`.
```

---

### Промпт 3 — Живые HUD-карточки, ЭКГ-волна и интерактив «До / После» на слайде

```text
Elevate the telemetry HUD in `src/components/PresentationView.tsx` and `src/data/presentationSlides.ts` (inspired by Linear, Vercel, and SpaceX Dragon telemetry UI) so judges immediately see real-time physiological cause-and-effect during the 6-slide briefing.

1. Honest Three-Tier Metric Cards (`Earth Reference` vs `Space Target` vs `Current Reading`):
Update `SlideMetricPair` in `src/data/presentationSlides.ts` and the left glassmorphic aside in `PresentationView.tsx` to clearly separate:
- `Earth 1g` baseline,
- `Spaceflight Target` normal range,
- `Current Scenario Reading` with semantic status dot (`#34D399` Nominal, `#FBBF24` Elevated, `#F87171` Critical) and text badge.
Add a compact 3-step clinical formula pill inside the secondary card: `Exposure → System Response → Next Check` (e.g., `4.2 mmHg CO₂ → Cranial Fluid Shift → Optic Nerve Ultrasound`).

2. Live Micro-ECG & Telemetry Polish:
- Inside the Cardiovascular card (Slide 03) and/or top status bar, render a lightweight 60fps SVG/Canvas ECG pulse waveform whose beat frequency and stroke color dynamically follow `vitals.heartRate` and the active scenario severity.
- Animate numeric transitions with `tabular-nums` smoothly without flashing misleading intermediate values, and add a subtle luminous border sweep on primary CTA buttons synchronized with `soundEngine.playHoverTick()`.
- Remove automatic `soundEngine.playAlertPulse()` firing merely on slide change; trigger audio cues only on explicit user actions (chapter transition whoosh, structure selection tone, or manual simulation action).

3. In-Briefing "Before / After" Countermeasure Moment:
Complement the existing `SYNC LIVE NASA DONKI` action on Slide 05 with a single interactive simulation toggle on Slide 04 (`Simulate ARED + 2.4L Hydration`). Clicking it inside the presentation updates the live `vitals` / `evaluation` state in place, shifting the 3D renal-bone cascade intensity and card status from Critical/Elevated toward Nominal—proving to judges that the 3D BioTwin reacts to real medical countermeasures before even entering the full CMO Console.
```

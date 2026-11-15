# Полный справочник для защиты проекта ARES-MED OS

> **Проект:** ARES-MED OS — *Astronaut Health & BioTwin Countermeasure Monitor*  
> **Событие:** 2026 NASA Space Apps Challenge (Almaty)  
> **Стек:** Next.js `15` (App Router) · React `19` · TypeScript `5.7` · Tailwind CSS `4` · Three.js `0.187` · Recharts `2.15` · Vitest `2.1`  
> **Проверка тестами:** `23` тестовых файла, `106` тестов (`vitest run` — все пройдены)  
> **Оговорка для жюри:** это образовательная/инженерная система поддержки решений на базе открытой литературы NASA (HRP, OSDR, CSA, SMO 016E / SOMA), **не** сертифицированное бортовое медицинское оборудование.

---

## 1. Суть проекта за 30 секунд (Elevator Pitch)

**Проблема:** В дальнем космосе (перелёт и база на Марсе) задержка связи с Землёй достигает **14 минут 20 секунд** в одну сторону (~29 минут на вопрос-ответ). Врачи ЦУП не могут вести астронавта в реальном времени. При этом обычные земные нормы давления, пульса, гидратации и глюкозы в невесомости недействительны, а нарушение в одной системе организма запускает **цепную реакцию (домино-каскад)** в других органах.

**Решение:** **ARES-MED OS** — это автономный цифровой двойник астронавта (**BioTwin**) и клиническая консоль бортового врача экипажа (**CMO**). Сайт объединяет:
1. **3D-презентацию проблемы и физиологии космоса** (`/`),
2. **Операционную консоль автономного врача** (`/?mode=console`),
3. **Предполётную лабораторию калибровки двойника** (`/preflight`),
4. **Аппаратный мост для реальных датчиков и космических API** (Web Bluetooth, пульс по веб-камере rPPG, CSA Astroskin, REST-буфер телеметрии, живая орбита МКС, солнечные вспышки NASA DONKI, исследования NASA OSDR).

---

## 2. Полный функционал сайта по страницам и компонентам

### Поверхность 1: `/` — 3D-брифинг (Презентация миссии)
Реализована в [PresentationStory.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/PresentationStory.tsx) поверх 3D-сцены [BioTwin3DStage.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/BioTwin3DStage.tsx):
- **Зацикленный 7-главный маршрут** ([briefingPath.ts](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/lib/briefingPath.ts)):
  `01 ARES-MED` → `02 MISSION CONTEXT` → `03 NEURO-OCULAR (SANS)` → `04 CARDIOVASCULAR` → `05 BONE & RENAL` → `06 RADIATION & IMMUNITY` → `07 METABOLIC & CIRCADIAN` → бесшовный возврат к `01`.
- **Интерактивный 3D-логотип** ([AresLogo3D.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/AresLogo3D.tsx)): объёмная модель знака `ARES-MED` с поддержкой ручного вращения и переходом в 3D-сцену.
- **Проекционные выноски органов:** SVG-линии и подписи автоматически следят за 3D-координатами активного органа при движении камеры и вращении модели.
- **Атмосфера и музыка:**
  - Атмосферные эффекты по главам ([chapterAtmosphere.ts](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/lib/chapterAtmosphere.ts), [orbitalMist.ts](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/lib/orbitalMist.ts)).
  - Плеер и Web Audio API синтезатор ([soundEngine.ts](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/lib/soundEngine.ts)) с динамическим плейлистом из `public/music/` (`max-brhon-dark-soul.m4a`, `i-saac-charon.mp3`) через `/api/music`.
- **Навигация и доступность:** колесо мыши, стрелки клавиатуры, `PageUp/PageDown`, `Home/End`, `[` / `]` для вращения модели, горизонтальный drag, точки навигации справа, кнопка `Reduce Motion` (`useReducedMotion.ts`) и кнопка `CMO CONSOLE` с анимацией перехода.

---

### Поверхность 2: `/?mode=console` — Консоль бортового врача (CMO Console)
Главный рабочий экран (`src/app/page.tsx`) разделён на 3 зоны и поддерживает изменение ширины колонок ([ResizablePanels.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/ResizablePanels.tsx)):

#### Зона A — Верхняя миссионная панель
- **Переключатель среды миссии** (`ISS Orbit 0g`, `Lunar Rover 0.16g`, `Mars Transit 0g / 14m 20s`, `Mars Base 0.38g / 14m 20s`).
- **Селектор профиля астронавта** (`ARES-1`–`ARES-3` или загруженный пользовательский профиль) + переход в `/preflight`.
- **4 встроенных демо-сценария для жюри** (мгновенно меняют телеметрию, цвет органов на 3D-модели и триггерят каскады).
- **Бейдж Mission Readiness (`0–100`)** — интегральный индекс готовности экипажа к задачам (учитывает штрафы систем, каскады и нагрузку среды).
- **Выдвижные панели (Drawers) и инструменты:**
  1. **Hardware Bridge** ([HardwareBridgeDrawer.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/HardwareBridgeDrawer.tsx)) — переключение источников телеметрии (`Sim Preset`, `Live Hardware`, `Hybrid Fault Overlay`), подключение Web Bluetooth, веб-камеры rPPG, CSA Astroskin, HTTP-буфера.
  2. **Telemetry Charts & Vitals Input** ([TelemetryCharts.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/TelemetryCharts.tsx), [VitalsInputPanel.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/VitalsInputPanel.tsx)) — графики трендов за 14 солов (`Crew Vitals`, `OSDR EDA · CO2`, `RadLab · Dose`) на Recharts + слайдеры и числовые поля для ручной симуляции любого показателя (пульс, АД, CO₂, радиация, гидратация, сон, температура, глюкоза, настроение, пропуск ARED, глазные симптомы).
  3. **Countermeasure Routine & XP** ([RoutineGamificationBar.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/RoutineGamificationBar.tsx), [routineStorage.ts](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/lib/routineStorage.ts)) — ежедневный чек-лист профилактических контрмер (ARED, гидратация, CO₂-проверка и др.) с сохранением в `localStorage`, начислением XP и рангами: `Tier 1 · Flight Cadet` → `Tier 2 · Crew Medical Specialist` (`>= 60 XP`) → `Tier 3 · Autonomous CMO` (`>= 115 XP`).
  4. **NASA DONKI Sync** — подгрузка актуальных солнечных вспышек и статуса радиации.
  5. **Кнопка возврата к слайдам (`/`).**

#### Зона B — Клиническая рабочая область
- **Левая панель: 3D BioTwin + 2D-режим + Каскады**
  - **3 режима 3D-шейдеров** ([BioTwin3DStage.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/BioTwin3DStage.tsx)):
    - `atlas` — анатомическая подсветка органов в цвет статуса (`норма / внимание / критика`).
    - `xray` — полупрозрачная Fresnel-оболочка тела с акцентом на скелет и внутренние органы.
    - `vascular` — высококонтрастный сосудистый/гемодинамический шейдер с `UnrealBloomPass`.
  - **Переключатель `2D Blueprint`** ([BioTwinBodyMap.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/BioTwinBodyMap.tsx)) — векторная медицинская схема для быстрого обзора или слабых устройств.
  - **Матрица `3×2` систем организма** (клик фокусирует камеру на органе) + монитор активных **Domino Cascades**.
- **Правая панель: 4-шаговая консоль решений CMO** ([AutonomousCmoPanel.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/components/AutonomousCmoPanel.tsx)):
  1. **`1. Triage`** — радиальный индикатор `Readiness 0–100`, сравнение земных и космических норм, объяснение активного домино-каскада и персональной чувствительности BioTwin.
  2. **`2. Exam`** — офлайн-протоколы самоосмотра (*Normal Observation* vs *Escalation Trigger*), включая встроенную интерактивную **сетку Амслера (Amsler Grid)** для выявления искажений зрения при SANS и **калипер УЗИ оболочки зрительного нерва (ONSD)** с порогом `<= 5.0 mm`.
  3. **`3. Act`** — список медицинских контрмер и препаратов с **предварительной PK/PD-симуляцией**: до применения видно, как изменится Readiness и какие есть **противопоказания для конкретного астронавта**.
  4. **`4. Link`** — генератор асинхронного пакета **DTN (Delay Tolerant Networking)** для отправки Flight Surgeon на Землю с копированием и статусом очереди при задержке связи.

#### Зона C — Нижний док телеметрии
- 6 живых каналов биометрии со спарклайнами и шаговым управлением: `HR` (bpm), `BP` (mmHg), `Cabin pCO2` (mmHg), `RadLab` (mSv/day), `Hydration` (mL/day), `Sleep` (hrs).

---

### Поверхность 3: `/preflight` — Предполётная лаборатория BioTwin
Реализована в [preflight/page.tsx](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/app/preflight/page.tsx) и [crewProfileStorage.ts](file:///c:/.personal/.development/hakaton/astronaut-health-monitor/src/lib/crewProfileStorage.ts) для калибровки экипажа за 90–180 дней до запуска (`L-180 / L-90`):
1. **Dossier & Ingestion** — drag-and-drop загрузка досье (`JSON`, `TXT`, `CSV`) с отслеживанием происхождения каждого поля (`provenance tracking`) и защитой от загрузки бинарных PDF без текста.
2. **Qualification & Sim** — 4 квалификационных стресс-теста JSC (*Tilt-Table Orthostatic*, *CO₂ Rebreathing*, *Exercise VO₂/ARED*, *Renal Supersaturation*), маркеры SOMA (`MTRR A66G`, `CYP2D6`, `CYP2C9`, `ATM`) и биохимия SMO 016E.
3. **Model & API Engine** — выбор одного из **3 режимов инференса**:
   - `local_mechanistic` — полностью автономный бортовой расчёт без сети.
   - `local_ollama_llm` — локальная языковая модель (Ollama / LM Studio на `localhost`).
   - `open_api` — через серверный `/api/twin-simulate` или пользовательский OpenAI-совместимый API (Bearer-ключи хранятся только в `sessionStorage` браузера).
4. **Manual Overrides** — точная ручная подстройка биологических множителей чувствительности органов перед полётом.

---

## 3. Научная база: 5 угроз NASA, космические нормы и 5 домино-каскадов

### 5 угроз космического полёта (NASA HRP)
*Space Radiation* · *Isolation & Confinement* · *Distance from Earth* · *Gravity Fields* · *Hostile Closed Environments*.

### Сдвиг норм: Земля vs Космос (`clinicalThresholds.ts` / `nasaHrpData.ts`)

| Показатель | Земля | Космос (ISS / BLEO) | Почему норма сдвигается |
| :--- | :--- | :--- | :--- |
| **Давление (BP)** | `95–120 / 60–80` | `100–128 / 65–84 mmHg` | В `0g` ~2 л жидкости приливают к голове |
| **Пульс (HR)** | `60–100 bpm` | `52–88 bpm` | Снижение нагрузки на сердце в покое в `0g` |
| **Глюкоза (натощак)** | `70–99 mg/dL` | `75–110 mg/dL` | Субклиническая инсулинорезистентность (`OSD-104`) |
| **Температура тела** | `36.1–37.2 °C` | `36.3–37.5 °C` | Отсутствие естественной конвекции замедляет охлаждение |
| **Сон** | `7.0–9.0 ч` | `6.5–8.0 ч` | 16 рассветов/сутки на НОО и 24ч 39м сол на Марсе |
| **Гидратация** | `2,000–2,500 mL` | `>= 2,400 mL/сут` | Нужна для вымывания Ca²⁺ от резорбции костей (`1–1.5%/мес`) |
| **Cabin pCO₂** | `0.3 mmHg` | `<= 3.0 mmHg` | В замкнутом контуре уровень выше в 8–10 раз (`>3.5` бьёт по SANS) |
| **Радиация** | `0.008 mSv/сут` | `0.5 (LEO) / 1.8 (Deep Space)` | ГКЛ, протоны ЮАА (SAA), солнечные вспышки (SPE) |

### 5 межоорганных домино-каскадов (`triageEngine.ts`)
1. **`gravity_fluid_sans`** (`cardiovascular` → `neuro_ocular`): `0g` прилив жидкости + `BP >= 132 mmHg` или `pCO₂ > 3.5 mmHg` / глазные симптомы → повышение ВЧД и риск отёка зрительного нерва (**SANS**).
2. **`bone_calcium_renal`** (`cardiovascular` → `musculoskeletal_renal`): потеря Ca²⁺ при `< 1g` (и пропуске ARED) + низкая гидратация (`< 2,000 mL`, красная зона `< 1,500 mL`) → камни в почках.
3. **`radiation_sleep_immune`** (`behavioral_circadian` → `immune_hematology`): радиация `> 1.2 mSv/сут` или вспышка M/X + сон `< 6.5 ч` → падение Т-клеточного иммунитета.
4. **`stress_glucose_metabolic`** (`behavioral_circadian` → `metabolic_endocrine`): недосып `< 6.0 ч` или стресс (`mood <= 4/10`) + глюкоза `> 110 mg/dL` → усиление инсулинорезистентности.
5. **`drug_acetazolamide_renal`** (`neuro_ocular` → `musculoskeletal_renal`): **фармакогеномическая ловушка** — приём `Acetazolamide` при склонности к камнеобразованию (демо-профиль **`ARES-2 Dr. Marcus Chen`**) защелачивает мочу и резко повышает риск CaPO₄-камней.

### 4 встроенных сценария для жюри (`DEMO_SCENARIOS`)
- **`nominal` (Nominal ISS Routine):** `pCO₂ 2.8 mmHg`, гидратация `2,550 mL`, ARED выполнен → все 6 систем в норме.
- **`sans_co2_fluid_shift` (Fluid Shift + CO₂):** `BP 138/88 mmHg`, `pCO₂ 4.2 mmHg`, нечёткое зрение → срабатывает `gravity_fluid_sans`.
- **`renal_dehydration` (Bone Ca²⁺ → Renal Stone):** перелёт к Марсу (`14m 20s` задержка), пропущен ARED, гидратация `1,200 mL`, сон `5.7 ч` → срабатывает `bone_calcium_renal`.
- **`solar_storm` (Solar Particle Event X-Flare):** луноход (`0.16g`), вспышка X-класса (`3.2 mSv/сут`), сон `5.8 ч`, температура `37.9 °C` → срабатывает `radiation_sleep_immune`.

---

## 4. Аппаратный мост, внешние данные и REST API

### 4 адаптера биометрии (`biometricBridge.ts` & `telemetryMultiplexer.ts`)
1. **CSA Astroskin** — симуляция/адаптер жилета непрерывного мониторинга (`1 Hz`).
2. **Web Bluetooth GATT** — прямое подключение браузера к нагрудному/носимому пульсометру по стандартному UUID `0x180D` (`Heart Rate Service` / `0x2A37`).
3. **Webcam rPPG** — бесконтактное измерение пульса с веб-камеры по оптическому изменению зелёного канала кожи лица через дискретное преобразование Фурье (DFT).
4. **HTTP Hardware Ingest** — приём данных от Arduino / ESP32 / Apple Health / тестовых стендов через `POST /api/telemetry`.

### 3 HTTP API эндпоинта
- **`GET / POST /api/telemetry`** (`NASA-CHP-IDA-1.0`) — потокобезопасный буфер телеметрии с валидацией и ограничением диапазонов (`clampVitalReadings`).
- **`GET / POST / OPTIONS /api/twin-simulate`** (`ARES-TWIN/1.0`) — серверная симуляция эффекта препаратов и триажа для профилей экипажа: лимит тела `64 KB`, CORS-заголовки, коды `400 / 404 / 413 / 422`, защита от SSRF (игнорирует внешние URL от клиента).
- **`GET /api/music`** — динамически сканирует `public/music/` и возвращает отсортированный список аудиотреков (`.mp3`, `.m4a`, `.ogg`, `.wav`, `.aac`, `.flac`, `.webm`).

### Живые космические фиды (`issLiveTelemetry.ts`, `nasaApi.ts`)
- **WhereTheISS:** реальные координаты МКС, день/ночь, статус прохождения Южно-Атлантической аномалии (SAA) с детерминированным офлайн-фолбэком.
- **NASA DONKI:** реальные солнечные вспышки (`DEMO_KEY` или `NEXT_PUBLIC_NASA_API_KEY`).
- **NASA OSDR:** метаданные и ссылки на реальные исследования (`OSD-37`, `OSD-48`, `OSD-104`, `OSD-135`, `OSD-255`, `OSD-530`).

---

## 5. Пошаговый сценарий живого демо (2–3 минуты)

1. **Старт на `/` (15 сек):** показать вращающийся 3D-логотип и полупрозрачного 3D-астронавта, прокрутить до 2-й/3-й главы (показать автонаведение камеры на органы) и нажать `CMO CONSOLE`.
2. **Сценарий `SANS` (35 сек):** на `/?mode=console` выбрать пресет *Fluid Shift + CO₂ (SANS)* → показать красный/жёлтый статус и каскад `gravity_fluid_sans` → открыть вкладку **Exam** → покликать **сетку Амслера** и **калипер УЗИ ONSD**.
3. **Персональная ловушка BioTwin (45 сек):** выбрать профиль **`ARES-2 Dr. Marcus Chen`** → перейти во вкладку **Act** → выбрать **Acetazolamide** → показать, как движок предупреждает о риске камней в почках (`drug_acetazolamide_renal`) и заранее пересчитывает дельту Readiness.
4. **Дальний космос + Hardware Bridge (30 сек):** переключить среду на `Mars Transit (14m 20s)` → показать вкладку **Link** (формирование DTN-пакета) → открыть **Hardware Bridge** (показать Web Bluetooth / Webcam rPPG / `POST /api/telemetry`).
5. **Предполётный `/preflight` (20 сек):** перейти в `/preflight` и показать загрузку досье, генетические маркеры SOMA и переключение между офлайн-движком `local_mechanistic`, локальной `Ollama` и `open_api`.

---

## 6. Частые вопросы жюри и готовые ответы

- **«Чем вы отличаетесь от Apple Watch / Garmin / обычного дашборда?»**  
  Обычные трекеры сравнивают показатели с земными нормами по отдельности. Мы используем **космические пороги NASA**, находим **5 межоорганных домино-каскадов** и учитываем **генетику конкретного астронавта (SOMA)** до назначения лекарств.
- **«Что будет при полной потере связи с Землёй?»**  
  Ключевой движок (`local_mechanistic`) работает **на 100% в браузере без интернета**. Все внешние фиды имеют офлайн-фолбэки, а отчёты для Земли складываются в отложенный пакет **DTN**.
- **«Откуда 3D-модель и медицинские цифры?»**  
  3D-органы собраны скриптами в Blender из открытого атласа **NIH / HuBMAP Visible Human Male (CC-BY 4.0)** (`scripts/fetch_opensource_anatomy.py`, `scripts/build_biotwin_glb.py`). Пороги и каскады опираются на опубликованные данные **NASA HRP**, **SMO 016E** и **OSDR**.
- **«Это безопасный код? Что с API-ключами?»**  
  Ключи пользователей для LLM хранятся строго в `sessionStorage` браузера, `/api/twin-simulate` ограничивает размер запроса (`64 KB`) и блокирует SSRF-редиректы на произвольные URL.

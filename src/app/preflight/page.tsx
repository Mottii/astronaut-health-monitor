"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  FileText,
  FlaskConical,
  Globe,
  Menu,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { BODY_SYSTEM_METADATA, MISSION_ENVIRONMENTS } from "@/data/nasaHrpData";
import { ALL_BIOLOGICAL_FIELDS, RENAL_STONE } from "@/lib/clinicalThresholds";
import {
  CREW_PROFILE_STORAGE_KEY,
  createDefaultCrewProfilesState,
  loadCrewProfilesState,
  parseUploadedDossierReport,
  saveCrewProfilesState,
  type CrewProfilesStorageState,
} from "@/lib/crewProfileStorage";
import { evaluateCrewHealth } from "@/lib/triageEngine";
import {
  computeOrganSensitivityMultipliers,
  generateTwinConsultationSummary,
  runPreFlightQualificationSuite,
  type TwinConsultationResult,
} from "@/lib/twinEngine";
import type {
  AstronautBiologicalProfile,
  BodySystemId,
  CypMetabolizerPhenotype,
  MtrrGenotype,
  TwinInferenceMode,
} from "@/types/health";

type AdminNavView = "dossier" | "qualification" | "engine" | "overrides";

const SYSTEM_ORDER: BodySystemId[] = [
  "neuro_ocular",
  "musculoskeletal_renal",
  "immune_hematology",
  "cardiovascular",
  "metabolic_endocrine",
  "behavioral_circadian",
];

const CYP_LABELS: Record<CypMetabolizerPhenotype, string> = {
  ultra_rapid: "Ultra-Rapid",
  normal: "Normal",
  intermediate: "Intermediate",
  poor: "Poor",
};

const MTRR_LABELS: Record<MtrrGenotype, string> = {
  AA_normal: "AA Normal",
  AG_heterozygous: "AG Heterozygous (+0.15x)",
  GG_sans_risk: "GG Risk Allele (+0.35x)",
};

export default function PreFlightAdminPage() {
  const [store, setStore] = useState<CrewProfilesStorageState>(
    createDefaultCrewProfilesState
  );
  const savePendingRef = useRef(false);
  const [activeView, setActiveView] = useState<AdminNavView>("dossier");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lastIngestedFile, setLastIngestedFile] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<{
    kind: "ok" | "warn" | "err";
    text: string;
  } | null>(null);
  const [consultation, setConsultation] = useState<TwinConsultationResult | null>(
    null
  );
  const [isConsulting, setIsConsulting] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const commitStore = useCallback(
    (
      updater: (prev: CrewProfilesStorageState) => CrewProfilesStorageState
    ) => {
      savePendingRef.current = true;
      setStore((prev) => ({
        ...updater(prev),
        updatedAt: Date.now(),
      }));
    },
    []
  );

  useEffect(() => {
    setStore(loadCrewProfilesState());
  }, []);

  useEffect(() => {
    if (!savePendingRef.current) return;
    savePendingRef.current = false;
    saveCrewProfilesState(store);
  }, [store]);

  useEffect(() => {
    const syncFromStorage = () => {
      const incoming = loadCrewProfilesState();
      setStore((prev) =>
        incoming.updatedAt > prev.updatedAt ? incoming : prev
      );
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === CREW_PROFILE_STORAGE_KEY) {
        syncFromStorage();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncFromStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, []);

  const activeProfile = useMemo(
    () =>
      store.profiles.find((p) => p.id === store.activeProfileId) ??
      store.profiles[0],
    [store.profiles, store.activeProfileId]
  );

  const multipliers = useMemo(
    () => computeOrganSensitivityMultipliers(activeProfile),
    [activeProfile]
  );

  const qualificationTests = useMemo(
    () => runPreFlightQualificationSuite(activeProfile),
    [activeProfile]
  );

  const baselineEval = useMemo(
    () =>
      evaluateCrewHealth(
        {
          bloodPressureSystolic: 122,
          bloodPressureDiastolic: 78,
          heartRateBpm: 68,
          bloodGlucoseMgDl: 94,
          bodyTempC: 36.8,
          sleepHours: 7.2,
          moodScore: 8,
          hydrationMl: 2350,
          ocularFinding: "clear",
          aredExerciseCompleted: true,
        },
        MISSION_ENVIRONMENTS[activeProfile.missionAssignment].defaultTelemetry,
        activeProfile.missionAssignment,
        activeProfile
      ),
    [activeProfile]
  );

  function updateActiveProfile(
    updater: (prev: AstronautBiologicalProfile) => AstronautBiologicalProfile
  ) {
    setConsultation(null);
    commitStore((prev) => {
      const targetId =
        prev.profiles.find((p) => p.id === prev.activeProfileId)?.id ??
        prev.profiles[0]?.id;
      return {
        ...prev,
        profiles: prev.profiles.map((p) => {
          if (p.id !== targetId) return p;
          const updated = updater(p);
          return {
            ...updated,
            provenance: {
              sourceType: "manual_override",
              fileName: p.provenance?.fileName,
              suppliedFields: [...ALL_BIOLOGICAL_FIELDS],
              defaultedFields: [],
            },
          };
        }),
      };
    });
  }

  function handleSelectPersona(id: string) {
    setConsultation(null);
    setUploadNotice(null);
    setLastIngestedFile(null);
    commitStore((prev) => ({ ...prev, activeProfileId: id }));
    setMobileNavOpen(false);
  }

  async function ingestDossierFile(file: File) {
    setUploadNotice(null);
    try {
      const text = await file.text();
      const result = parseUploadedDossierReport(file.name, text);
      if (!result.ok) {
        setUploadNotice({
          kind: "err",
          text: result.error,
        });
        return;
      }
      const parsed = result.profile;
      setConsultation(null);
      setLastIngestedFile(file.name);
      commitStore((prev) => {
        const exists = prev.profiles.some((p) => p.id === parsed.id);
        return {
          ...prev,
          activeProfileId: parsed.id,
          profiles: exists
            ? prev.profiles.map((p) => (p.id === parsed.id ? parsed : p))
            : [...prev.profiles, parsed],
        };
      });
      const totalFields = ALL_BIOLOGICAL_FIELDS.length;
      const suppliedCount =
        parsed.provenance?.suppliedFields.length ?? totalFields;
      const defaulted = parsed.provenance?.defaultedFields ?? [];
      const manyDefaulted = defaulted.length > totalFields / 2;
      const detail =
        defaulted.length > 0
          ? `Extracted ${suppliedCount}/${totalFields} fields; ${defaulted.length} defaulted to reference baseline: ${defaulted.join(", ")}.`
          : `Extracted ${suppliedCount}/${totalFields} fields cleanly for ${parsed.name} (${parsed.callsign}).`;
      setUploadNotice({
        kind: manyDefaulted ? "warn" : "ok",
        text: `${parsed.name} (${parsed.callsign}): ${detail}`,
      });
      setActiveView("dossier");
    } catch {
      setUploadNotice({
        kind: "err",
        text: `Failed to ingest "${file.name}".`,
      });
    }
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await ingestDossierFile(file);
    }
    e.target.value = "";
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await ingestDossierFile(file);
    }
  }

  function handleDownloadJson() {
    const blob = new Blob([JSON.stringify(activeProfile, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProfile.callsign.toLowerCase()}-dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleResetDefaults() {
    setConsultation(null);
    setLastIngestedFile(null);
    commitStore(() => createDefaultCrewProfilesState());
    setUploadNotice({
      kind: "ok",
      text: "Restored 3 NASA JSC pre-flight baselines.",
    });
  }

  async function handleRunConsultation() {
    setIsConsulting(true);
    try {
      const res = await generateTwinConsultationSummary(
        activeProfile,
        baselineEval,
        store.inferenceConfig
      );
      setConsultation(res);
    } finally {
      setIsConsulting(false);
    }
  }

  function handleModeChange(mode: TwinInferenceMode) {
    setConsultation(null);
    commitStore((prev) => ({
      ...prev,
      inferenceConfig: {
        ...prev.inferenceConfig,
        mode,
      },
    }));
  }

  const openApiCurlSnippet = `curl -X POST http://localhost:3000/api/twin-simulate \\
  -H "Content-Type: application/json" \\
  -d '{"profileId":"${activeProfile.id}","envId":"${activeProfile.missionAssignment}","actionId":"neuro_acetazolamide_rx"}'`;

  async function handleCopyCurl() {
    try {
      await navigator.clipboard.writeText(openApiCurlSnippet);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 1800);
    } catch {
      setCopiedCurl(true);
    }
  }

  const engineLabel =
    store.inferenceConfig.mode === "local_mechanistic"
      ? "Local Blackout"
      : store.inferenceConfig.mode === "local_ollama_llm"
      ? "Local LLM"
      : "Open API";

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#141414] text-[#ececec] antialiased">
      {/* Hidden Shared JSON / TXT / CSV File Input */}
      <input
        ref={fileInputRef}
        data-testid="dossier-upload-input"
        type="file"
        accept=".json,.txt,.csv,application/json,text/plain,text/csv"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR — ChatGPT / Claude Desktop Navigation Rail */}
      <aside
        aria-label="Pre-Flight Admin Sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] shrink-0 flex-col justify-between border-r border-white/[0.06] bg-[#0d0d0d] p-3 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Sidebar Brand + Close Mobile */}
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 32 32"
                className="h-4 w-4 text-[#ececec]"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 26L14.5 6H18.5L28 26H23.2L16.5 11.4L9.2 26H4Z"
                  fill="currentColor"
                />
                <path
                  d="M5 20.5C11.5 14 20.5 11 29 9.5"
                  stroke="#0d0d0d"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[13px] font-semibold tracking-wide text-[#ececec]">
                ARES-MED
              </span>
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[#9b9b9b]">
                Admin
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close sidebar"
              className="rounded-lg p-1 text-[#9b9b9b] hover:bg-white/[0.06] hover:text-white md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Primary In-Flight 3D Console Link */}
          <Link
            href="/?mode=console"
            data-testid="launch-3d-console-link"
            className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#171717] px-3 py-2 text-xs font-medium text-[#ececec] transition hover:border-white/20 hover:bg-[#1f1f1f]"
          >
            <span>In-Flight 3D Console</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#9b9b9b]" />
          </Link>

          {/* Primary Navigation Items */}
          <nav aria-label="Admin sections" className="mt-4 space-y-0.5">
            <p className="px-2 pb-1 text-[10.5px] font-medium text-[#676767]">
              Workspace
            </p>
            {(
              [
                {
                  id: "dossier",
                  label: "Dossier & Ingestion",
                  icon: FileText,
                },
                {
                  id: "qualification",
                  label: "Qualification & Sim",
                  icon: FlaskConical,
                },
                {
                  id: "engine",
                  label: "Model & API Engine",
                  icon: Cpu,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-[#1f1f1f] text-[#ececec]"
                      : "text-[#9b9b9b] hover:bg-[#161616] hover:text-[#ececec]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Crew Dossiers Sidebar List */}
          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="text-[10.5px] font-medium text-[#676767]">
                Crew Dossiers
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[10.5px] font-medium text-[#9b9b9b] transition hover:bg-white/[0.06] hover:text-[#ececec]"
              >
                + Upload
              </button>
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto pr-0.5">
              {store.profiles.map((profile) => {
                const active = profile.id === activeProfile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    data-testid={`preflight-persona-${profile.id}`}
                    onClick={() => handleSelectPersona(profile.id)}
                    aria-pressed={active}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                      active
                        ? "bg-[#1f1f1f] text-[#ececec]"
                        : "text-[#9b9b9b] hover:bg-[#161616] hover:text-[#ececec]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {profile.name}
                      </p>
                      <p className="truncate text-[10px] text-[#676767]">
                        {profile.callsign} ·{" "}
                        {MISSION_ENVIRONMENTS[profile.missionAssignment].name}
                      </p>
                    </div>
                    {active && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Admin Utility — Little Screw for Rare Manual Overrides */}
        <div className="mt-3 border-t border-white/[0.06] pt-2.5">
          <button
            type="button"
            data-testid="open-manual-overrides-btn"
            onClick={() => {
              setActiveView("overrides");
              setMobileNavOpen(false);
            }}
            aria-pressed={activeView === "overrides"}
            className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
              activeView === "overrides"
                ? "bg-[#1f1f1f] text-[#ececec]"
                : "text-[#7a7a7a] hover:bg-[#161616] hover:text-[#d4d4d4]"
            }`}
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Manual Overrides</span>
            </span>
            <span className="font-mono text-[10px] text-[#5c5c5c]">Rare</span>
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#141414]">
        {/* Top Minimalist Utility Bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open sidebar"
              className="rounded-lg border border-white/[0.08] p-1.5 text-[#9b9b9b] hover:text-white md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[#ececec]">
                {activeProfile.name}
              </span>
              <span className="text-[#676767]">/</span>
              <span className="font-mono text-[11px] text-[#9b9b9b]">
                {activeProfile.callsign}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView("engine")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1 text-[11px] text-[#b4b4b4] transition hover:border-white/20 hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{engineLabel}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              title="Export dossier JSON"
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1 text-[11px] text-[#b4b4b4] transition hover:border-white/20 hover:text-white"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>
          </div>
        </header>

        {/* Scrollable Centered Editorial Container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {uploadNotice && (
              <div
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                  uploadNotice.kind === "ok"
                    ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200"
                    : uploadNotice.kind === "warn"
                    ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-200"
                    : "border-rose-500/30 bg-rose-500/[0.08] text-rose-200"
                }`}
              >
                <span>{uploadNotice.text}</span>
                <button
                  type="button"
                  onClick={() => setUploadNotice(null)}
                  className="text-current opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* VIEW 1: ONE-SHOT DOSSIER & READ-ONLY SPEC SHEET */}
            {activeView === "dossier" && (
              <>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-[#676767]">
                    JSC Pre-Flight Calibration · L-180 / L-90 Baseline
                  </p>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-[#ececec]">
                      {activeProfile.name}
                    </h1>
                    <span className="font-mono text-xs text-[#9b9b9b]">
                      {activeProfile.role}
                    </span>
                  </div>
                  <p className="text-xs text-[#9b9b9b]">
                    {activeProfile.summaryTag} · Mission:{" "}
                    {MISSION_ENVIRONMENTS[activeProfile.missionAssignment].name}
                  </p>
                  {activeProfile.provenance && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span
                        data-testid="profile-provenance-pill"
                        className="rounded-md border border-white/[0.08] bg-[#1a1a1a] px-2 py-0.5 font-mono text-[10.5px] text-[#bdbdbd]"
                      >
                        {activeProfile.provenance.sourceType} ·{" "}
                        {activeProfile.provenance.suppliedFields.length}/
                        {ALL_BIOLOGICAL_FIELDS.length} fields supplied
                        {activeProfile.provenance.fileName
                          ? ` (${activeProfile.provenance.fileName})`
                          : ""}
                      </span>
                      {activeProfile.provenance.defaultedFields.length > 0 && (
                        <span className="font-mono text-[10.5px] text-amber-300">
                          Baseline-defaulted:{" "}
                          {activeProfile.provenance.defaultedFields.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* One-Shot JSON / TXT / CSV Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`rounded-2xl border p-4 transition ${
                    isDragging
                      ? "border-white/40 bg-[#242424]"
                      : "border-white/[0.08] bg-[#1b1b1b]"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-[#ececec]">
                        One-Shot Crew Biological Dossier Ingestion
                      </p>
                      <p className="text-[11.5px] text-[#8e8e8e]">
                        Drop a structured JSON, TXT, or CSV lab report to
                        populate blood chemistry, SOMA genomics, and chamber
                        endurance limits automatically. Binary PDFs are
                        rejected offline—export text or JSON first.
                      </p>
                      {lastIngestedFile && (
                        <p className="pt-1 font-mono text-[10.5px] text-emerald-300">
                          Loaded file: {lastIngestedFile}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[#ececec] px-3.5 py-2 text-xs font-medium text-[#141414] transition hover:bg-white"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Upload JSON / TXT / CSV</span>
                    </button>
                  </div>
                </div>

                {/* Calibrated 6-Organ Sensitivity Strip */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-medium text-[#9b9b9b]">
                      Calibrated 6-Organ Sensitivity Matrix
                    </h2>
                    <span className="font-mono text-[10.5px] text-[#676767]">
                      Applied live on 3D BioTwin
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {SYSTEM_ORDER.map((sysId) => {
                      const mult = multipliers[sysId];
                      const meta = BODY_SYSTEM_METADATA[sysId];
                      const dotClass =
                        mult >= 1.4
                          ? "bg-rose-400"
                          : mult >= 1.15
                          ? "bg-amber-400"
                          : "bg-emerald-400";
                      return (
                        <div
                          key={sysId}
                          className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#1a1a1a] px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
                            />
                            <span className="truncate text-[11.5px] text-[#d4d4d4]">
                              {meta.shortLabel.split(" / ")[0]}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-medium tabular-nums text-[#ececec]">
                            {mult.toFixed(2)}x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Read-Only Clean Specification Sheet (Zero Slider Clutter) */}
                <section className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a1a]">
                  {/* Section 1: Biochemical */}
                  <div className="p-4">
                    <h3 className="text-xs font-medium text-[#9b9b9b]">
                      Biochemical Panel (NASA SMO 016E)
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
                      {[
                        [
                          "24h Urinary Calcium",
                          `${activeProfile.biochemical.urinaryCalciumMgDay} mg/day`,
                          activeProfile.biochemical.urinaryCalciumMgDay >
                            RENAL_STONE.caHigh,
                        ],
                        [
                          "24h Urinary Citrate",
                          `${activeProfile.biochemical.urinaryCitrateMgDay} mg/day`,
                          activeProfile.biochemical.urinaryCitrateMgDay <
                            RENAL_STONE.citrateLow,
                        ],
                        [
                          "Serum CTX (Resorption)",
                          `${activeProfile.biochemical.serumCtxPgMl} pg/mL`,
                          activeProfile.biochemical.serumCtxPgMl >= 500,
                        ],
                        [
                          "Baseline Lymphocytes (ALC)",
                          `${activeProfile.biochemical.baselineLymphocyteCount} /uL`,
                          activeProfile.biochemical.baselineLymphocyteCount <
                            1600,
                        ],
                        [
                          "Serum Ferritin",
                          `${activeProfile.biochemical.serumFerritinNgMl} ng/mL`,
                          activeProfile.biochemical.serumFerritinNgMl >= 170,
                        ],
                        [
                          "Neurofilament Light (NfL)",
                          `${activeProfile.biochemical.baselineNflPgMl} pg/mL`,
                          activeProfile.biochemical.baselineNflPgMl >= 11,
                        ],
                      ].map(([label, val, warn]) => (
                        <div
                          key={label as string}
                          className="flex items-center justify-between border-b border-white/[0.04] pb-1.5"
                        >
                          <dt className="text-[#8e8e8e]">{label}</dt>
                          <dd
                            className={`font-mono font-medium ${
                              warn ? "text-amber-300" : "text-[#ececec]"
                            }`}
                          >
                            {val}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Section 2: Genomics */}
                  <div className="p-4">
                    <h3 className="text-xs font-medium text-[#9b9b9b]">
                      SOMA Pharmacogenomic Fingerprint
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">MTRR A66G (SANS)</dt>
                        <dd
                          className={`font-mono font-medium ${
                            activeProfile.pharmacogenomics.mtrrGenotype ===
                            "GG_sans_risk"
                              ? "text-amber-300"
                              : "text-[#ececec]"
                          }`}
                        >
                          {
                            MTRR_LABELS[
                              activeProfile.pharmacogenomics.mtrrGenotype
                            ]
                          }
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">ATM DNA Repair</dt>
                        <dd
                          className={`font-mono font-medium ${
                            activeProfile.pharmacogenomics.atmDnaRepairScore <
                            0.8
                              ? "text-rose-300"
                              : "text-[#ececec]"
                          }`}
                        >
                          {activeProfile.pharmacogenomics.atmDnaRepairScore.toFixed(
                            2
                          )}
                          x
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">CYP2D6 Clearance</dt>
                        <dd className="font-mono font-medium text-[#ececec]">
                          {
                            CYP_LABELS[
                              activeProfile.pharmacogenomics.cyp2d6Phenotype
                            ]
                          }
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">CYP2C9 Clearance</dt>
                        <dd className="font-mono font-medium text-[#ececec]">
                          {
                            CYP_LABELS[
                              activeProfile.pharmacogenomics.cyp2c9Phenotype
                            ]
                          }
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Section 3: Endurance Envelope */}
                  <div className="p-4">
                    <h3 className="text-xs font-medium text-[#9b9b9b]">
                      JSC Chamber Endurance Envelope
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">CO2 Reactivity Slope</dt>
                        <dd className="font-mono font-medium text-[#ececec]">
                          {activeProfile.endurance.co2ReactivitySlope.toFixed(2)}
                          x
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">Baseline ONSD</dt>
                        <dd className="font-mono font-medium text-[#ececec]">
                          {activeProfile.endurance.baselineOnsdMm.toFixed(1)} mm
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">DEXA Femoral T-Score</dt>
                        <dd className="font-mono font-medium text-[#ececec]">
                          {activeProfile.endurance.dexaBoneTScore.toFixed(1)} SD
                        </dd>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                        <dt className="text-[#8e8e8e]">LBNP / SPE Threshold</dt>
                        <dd className="font-mono font-medium text-[#ececec]">
                          {activeProfile.endurance.lbnpEnduranceMin}m ·{" "}
                          {activeProfile.endurance.radiationToleranceMsvDay} mSv/d
                        </dd>
                      </div>
                    </dl>
                  </div>
                </section>

                {/* Quiet Footer Link to Rare Manual Overrides */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#676767]">
                  <span>
                    Rare calibration exception? Adjust raw values inside Manual
                    Overrides.
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveView("overrides")}
                    className="inline-flex cursor-pointer items-center gap-1 text-[#9b9b9b] underline-offset-4 hover:text-[#ececec] hover:underline"
                  >
                    <Settings2 className="h-3 w-3" />
                    <span>Open Overrides</span>
                  </button>
                </div>
              </>
            )}

            {/* VIEW 2: PRE-FLIGHT QUALIFICATION SIMULATIONS & AI CONSULTATION */}
            {activeView === "qualification" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-semibold text-[#ececec]">
                      Qualification Simulations & AI Twin Synthesis
                    </h1>
                    <p className="text-xs text-[#8e8e8e]">
                      Pre-run stress assays calibrated for {activeProfile.name} (
                      {activeProfile.callsign}) using {engineLabel}.
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="run-twin-consultation-btn"
                    onClick={handleRunConsultation}
                    disabled={isConsulting}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#ececec] px-4 py-2 text-xs font-medium text-[#141414] transition hover:bg-white disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isConsulting
                        ? "Synthesizing..."
                        : "Run Twin Consultation"}
                    </span>
                  </button>
                </div>

                {consultation && (
                  <div
                    data-testid="twin-consultation-output"
                    className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#1a1a1a] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#9b9b9b]">
                      <span className="inline-flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{consultation.engineUsed}</span>
                      </span>
                      <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#bdbdbd]">
                        {consultation.source}
                      </span>
                    </div>

                    {consultation.source === "fallback" &&
                      consultation.fallbackReason && (
                        <div
                          data-testid="consultation-fallback-banner"
                          className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-200"
                        >
                          Remote/local LLM unreachable ({consultation.fallbackReason})
                          — displaying offline mechanistic synthesis.
                        </div>
                      )}

                    <div className="rounded-xl border border-white/[0.08] bg-[#141414] p-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#9b9b9b]">
                        Deterministic Clinical Guardrails
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#ececec]">
                        {consultation.deterministicGuardrail}
                      </p>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#8e8e8e]">
                        Advisory Model Synthesis
                      </p>
                      <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#e5e5e5]">
                        {consultation.summaryText}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {qualificationTests.map((q) => {
                    const isContra = q.status === "contraindicated";
                    const isCaution = q.status === "caution";
                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border p-4 ${
                          isContra
                            ? "border-rose-500/35 bg-rose-500/[0.06]"
                            : isCaution
                            ? "border-amber-500/30 bg-amber-500/[0.04]"
                            : "border-white/[0.06] bg-[#1a1a1a]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-[#ececec]">
                              {q.title}
                            </h3>
                            <p className="mt-0.5 font-mono text-[11px] text-[#7e7e7e]">
                              {q.chamberOrAssay} · {q.enduranceLimitLabel}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                              isContra
                                ? "bg-rose-500/20 text-rose-300"
                                : isCaution
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/15 text-emerald-300"
                            }`}
                          >
                            {isContra ? (
                              <ShieldAlert className="h-3 w-3" />
                            ) : isCaution ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {q.status}
                          </span>
                        </div>
                        <p className="mt-2.5 text-xs leading-relaxed text-[#c2c2c2]">
                          {q.clinicalSummary}
                        </p>
                        <p className="mt-2 font-mono text-[11px] text-[#9b9b9b]">
                          Protocol: {q.recommendedInFlightCountermeasure}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* VIEW 3: DUAL INFERENCE ENGINE (LOCAL BLACKOUT VS OPEN API) */}
            {activeView === "engine" && (
              <>
                <div>
                  <h1 className="text-lg font-semibold text-[#ececec]">
                    Dual Inference Engine (Local Blackout vs. Open API)
                  </h1>
                  <p className="text-xs text-[#8e8e8e]">
                    Switch seamlessly between an offline spacecraft blackout
                    engine and an open REST / BYO LLM endpoint.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      {
                        id: "local_mechanistic",
                        title: "Local Blackout",
                        desc: "100% offline mechanistic PK/PD & NASA-STD-3001 thresholds",
                        icon: Cpu,
                      },
                      {
                        id: "local_ollama_llm",
                        title: "Local On-Device LLM",
                        desc: "Onboard Ollama / OpenAI-compatible localhost model",
                        icon: Bot,
                      },
                      {
                        id: "open_api",
                        title: "Open API",
                        desc: "POST /api/twin-simulate or external OpenAI-compatible API",
                        icon: Globe,
                      },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = store.inferenceConfig.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        data-testid={`inference-mode-${m.id}`}
                        onClick={() => handleModeChange(m.id)}
                        aria-pressed={active}
                        className={`flex cursor-pointer flex-col items-start rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-white/30 bg-[#222222]"
                            : "border-white/[0.06] bg-[#1a1a1a] hover:border-white/15"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-[#ececec]" />
                        <span className="mt-2.5 text-xs font-semibold text-[#ececec]">
                          {m.title}
                        </span>
                        <span className="mt-1 text-[11px] leading-snug text-[#8e8e8e]">
                          {m.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {store.inferenceConfig.mode === "local_ollama_llm" && (
                  <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[#8e8e8e]">
                        Quick Presets (Localhost Blackout Runtime)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            commitStore((prev) => ({
                              ...prev,
                              inferenceConfig: {
                                ...prev.inferenceConfig,
                                localEndpointUrl:
                                  "http://localhost:11434/v1/chat/completions",
                                localModelName:
                                  prev.inferenceConfig.localModelName ||
                                  "llama3.1:8b",
                              },
                            }))
                          }
                          className="cursor-pointer rounded-lg border border-white/[0.08] bg-[#121212] px-2.5 py-1 font-mono text-[11px] text-[#d4d4d4] hover:border-white/25 hover:text-white"
                        >
                          Ollama (:11434)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitStore((prev) => ({
                              ...prev,
                              inferenceConfig: {
                                ...prev.inferenceConfig,
                                localEndpointUrl:
                                  "http://localhost:1234/v1/chat/completions",
                                localModelName: "local-model",
                              },
                            }))
                          }
                          className="cursor-pointer rounded-lg border border-white/[0.08] bg-[#121212] px-2.5 py-1 font-mono text-[11px] text-[#d4d4d4] hover:border-white/25 hover:text-white"
                        >
                          LM Studio (:1234)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs text-[#9b9b9b]">
                        Local Endpoint URL
                        <input
                          type="text"
                          value={store.inferenceConfig.localEndpointUrl}
                          onChange={(e) =>
                            commitStore((prev) => ({
                              ...prev,
                              inferenceConfig: {
                                ...prev.inferenceConfig,
                                localEndpointUrl: e.target.value,
                              },
                            }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#121212] px-3 py-2 font-mono text-xs text-[#ececec] focus:border-white/25 focus:outline-none"
                        />
                      </label>
                      <label className="text-xs text-[#9b9b9b]">
                        Local Model Name
                        <input
                          type="text"
                          value={store.inferenceConfig.localModelName}
                          onChange={(e) =>
                            commitStore((prev) => ({
                              ...prev,
                              inferenceConfig: {
                                ...prev.inferenceConfig,
                                localModelName: e.target.value,
                              },
                            }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#121212] px-3 py-2 font-mono text-xs text-[#ececec] focus:border-white/25 focus:outline-none"
                        />
                      </label>
                    </div>

                    <p className="text-[11px] text-[#7c7c7c]">
                      Browser CORS note: start Ollama with{" "}
                      <code className="font-mono text-[#b4b4b4]">
                        OLLAMA_ORIGINS=&quot;*&quot;
                      </code>{" "}
                      so direct browser requests to localhost succeed; if
                      unreachable, consultation falls back cleanly to deterministic
                      guardrails.
                    </p>
                  </div>
                )}

                {store.inferenceConfig.mode === "open_api" && (
                  <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs text-[#9b9b9b]">
                        Simulation Endpoint URL
                        <input
                          type="text"
                          value={store.inferenceConfig.openApiEndpointUrl}
                          onChange={(e) =>
                            commitStore((prev) => ({
                              ...prev,
                              inferenceConfig: {
                                ...prev.inferenceConfig,
                                openApiEndpointUrl: e.target.value,
                              },
                            }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#121212] px-3 py-2 font-mono text-xs text-[#ececec] focus:border-white/25 focus:outline-none"
                        />
                      </label>
                      <label className="text-xs text-[#9b9b9b]">
                        Bearer Key (Optional BYO API)
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={store.inferenceConfig.openApiKey}
                          onChange={(e) =>
                            commitStore((prev) => ({
                              ...prev,
                              inferenceConfig: {
                                ...prev.inferenceConfig,
                                openApiKey: e.target.value,
                              },
                            }))
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#121212] px-3 py-2 font-mono text-xs text-[#ececec] focus:border-white/25 focus:outline-none"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-[#7c7c7c]">
                      Security: Bearer keys are kept in browser{" "}
                      <code className="font-mono text-[#b4b4b4]">
                        sessionStorage
                      </code>{" "}
                      only (cleared when the tab closes, never written to{" "}
                      <code className="font-mono text-[#b4b4b4]">
                        localStorage
                      </code>{" "}
                      or proxied through{" "}
                      <code className="font-mono text-[#b4b4b4]">
                        /api/twin-simulate
                      </code>
                      ).
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[#9b9b9b]">
                      Open REST Endpoint · POST /api/twin-simulate
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#9b9b9b] hover:bg-white/[0.06] hover:text-white"
                    >
                      {copiedCurl ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy cURL
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-[#0e0e0e] p-3 font-mono text-[11px] text-[#bdbdbd]">
                    {openApiCurlSnippet}
                  </pre>
                </div>
              </>
            )}

            {/* VIEW 4: THE "LITTLE SCREW" — RARE MANUAL PARAMETER OVERRIDES */}
            {activeView === "overrides" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h1 className="text-lg font-semibold text-[#ececec]">
                      Manual Parameter Overrides
                    </h1>
                    <p className="text-xs text-[#8e8e8e]">
                      Rare exception editor. Routine onboarding should use
                      one-shot JSON, TXT, or CSV dossier ingestion.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#1c1c1c] px-3 py-1.5 text-xs text-[#b4b4b4] hover:border-white/20 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset JSC Defaults
                  </button>
                </div>

                {/* Compact Identity Override */}
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-4 sm:grid-cols-3">
                  <label className="text-[11px] text-[#8e8e8e]">
                    Astronaut Name
                    <input
                      type="text"
                      value={activeProfile.name}
                      onChange={(e) =>
                        updateActiveProfile((p) => ({
                          ...p,
                          name: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#121212] px-2.5 py-1.5 text-xs text-[#ececec]"
                    />
                  </label>
                  <label className="text-[11px] text-[#8e8e8e]">
                    Callsign
                    <input
                      type="text"
                      value={activeProfile.callsign}
                      onChange={(e) =>
                        updateActiveProfile((p) => ({
                          ...p,
                          callsign: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#121212] px-2.5 py-1.5 font-mono text-xs text-[#ececec]"
                    />
                  </label>
                  <label className="text-[11px] text-[#8e8e8e]">
                    Mission Profile
                    <select
                      value={activeProfile.missionAssignment}
                      onChange={(e) =>
                        updateActiveProfile((p) => ({
                          ...p,
                          missionAssignment: e.target.value as
                            | "iss_orbit"
                            | "lunar_rover"
                            | "mars_transit"
                            | "mars_base",
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#121212] px-2.5 py-1.5 text-xs text-[#ececec]"
                    >
                      {Object.values(MISSION_ENVIRONMENTS).map((env) => (
                        <option key={env.id} value={env.id}>
                          {env.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Compact Tabular Numeric Overrides (No bloated slider grid) */}
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/[0.06] bg-[#1a1a1a] p-4 sm:grid-cols-2">
                  {(
                    [
                      ["urinaryCalciumMgDay", "Urinary Ca2+ (mg/d)", 40, 600, 1],
                      ["urinaryCitrateMgDay", "Urinary Citrate (mg/d)", 60, 900, 1],
                      ["serumCtxPgMl", "Serum CTX (pg/mL)", 80, 1400, 5],
                      [
                        "baselineLymphocyteCount",
                        "Baseline ALC (/uL)",
                        400,
                        5000,
                        50,
                      ],
                      ["serumFerritinNgMl", "Serum Ferritin (ng/mL)", 10, 600, 1],
                      ["baselineNflPgMl", "Baseline NfL (pg/mL)", 2, 60, 0.2],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 text-xs text-[#9b9b9b]"
                    >
                      <span>{label}</span>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={activeProfile.biochemical[key]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          updateActiveProfile((p) => ({
                            ...p,
                            biochemical: { ...p.biochemical, [key]: v },
                          }));
                        }}
                        className="w-24 rounded-lg border border-white/[0.08] bg-[#121212] px-2 py-1 text-right font-mono text-xs text-[#ececec]"
                      />
                    </label>
                  ))}

                  <label className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 text-xs text-[#9b9b9b]">
                    <span>MTRR A66G Genotype</span>
                    <select
                      value={activeProfile.pharmacogenomics.mtrrGenotype}
                      onChange={(e) =>
                        updateActiveProfile((p) => ({
                          ...p,
                          pharmacogenomics: {
                            ...p.pharmacogenomics,
                            mtrrGenotype: e.target.value as MtrrGenotype,
                          },
                        }))
                      }
                      className="rounded-lg border border-white/[0.08] bg-[#121212] px-2 py-1 font-mono text-xs text-[#ececec]"
                    >
                      <option value="AA_normal">AA_normal</option>
                      <option value="AG_heterozygous">AG_heterozygous</option>
                      <option value="GG_sans_risk">GG_sans_risk</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 text-xs text-[#9b9b9b]">
                    <span>CYP2C9 Phenotype</span>
                    <select
                      value={activeProfile.pharmacogenomics.cyp2c9Phenotype}
                      onChange={(e) =>
                        updateActiveProfile((p) => ({
                          ...p,
                          pharmacogenomics: {
                            ...p.pharmacogenomics,
                            cyp2c9Phenotype: e.target
                              .value as CypMetabolizerPhenotype,
                          },
                        }))
                      }
                      className="rounded-lg border border-white/[0.08] bg-[#121212] px-2 py-1 font-mono text-xs text-[#ececec]"
                    >
                      <option value="ultra_rapid">ultra_rapid</option>
                      <option value="normal">normal</option>
                      <option value="intermediate">intermediate</option>
                      <option value="poor">poor</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 text-xs text-[#9b9b9b]">
                    <span>ATM DNA Repair</span>
                    <input
                      type="number"
                      min={0.4}
                      max={1.5}
                      step={0.02}
                      value={activeProfile.pharmacogenomics.atmDnaRepairScore}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        updateActiveProfile((p) => ({
                          ...p,
                          pharmacogenomics: {
                            ...p.pharmacogenomics,
                            atmDnaRepairScore: v,
                          },
                        }));
                      }}
                      className="w-24 rounded-lg border border-white/[0.08] bg-[#121212] px-2 py-1 text-right font-mono text-xs text-[#ececec]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 text-xs text-[#9b9b9b]">
                    <span>CO2 Reactivity Slope</span>
                    <input
                      type="number"
                      min={0.5}
                      max={2.2}
                      step={0.05}
                      value={activeProfile.endurance.co2ReactivitySlope}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        updateActiveProfile((p) => ({
                          ...p,
                          endurance: {
                            ...p.endurance,
                            co2ReactivitySlope: v,
                          },
                        }));
                      }}
                      className="w-24 rounded-lg border border-white/[0.08] bg-[#121212] px-2 py-1 text-right font-mono text-xs text-[#ececec]"
                    />
                  </label>
                </div>
              </>
            )}

            <footer className="border-t border-white/[0.06] pt-4 text-[11px] text-[#676767]">
              ARES-TWIN/1.0 (NASA SSM · SMO 016E · SOMA-informed) · Synthetic
              demonstration profiles — educational simulation, not medical advice.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

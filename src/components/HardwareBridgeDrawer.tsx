"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bluetooth,
  Camera,
  Check,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  HeartPulse,
  Radio,
  RefreshCw,
  Satellite,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import { NASA_FLIGHT_HARDWARE_SPECS } from "@/data/nasaHrpData";
import {
  computeRppgHeartRateFromGreenSeries,
  connectWebBluetoothHeartRate,
  isWebBluetoothSupported,
} from "@/lib/biometricBridge";
import type {
  BiometricSourceType,
  IssLiveTelemetrySnapshot,
  OsdrStudyLiveMetadata,
  TelemetryMode,
  VitalReadings,
} from "@/types/health";

export interface HardwareBridgeDrawerProps {
  telemetryMode: TelemetryMode;
  onChangeTelemetryMode: (mode: TelemetryMode) => void;
  biometricSource: BiometricSourceType;
  onChangeBiometricSource: (source: BiometricSourceType) => void;
  liveVitals: VitalReadings;
  onLiveBiometricPatch: (patch: Partial<VitalReadings>) => void;
  faultDeltaSummary: string[];
  issSnapshot: IssLiveTelemetrySnapshot | null;
  isRefreshingIss: boolean;
  onRefreshIss: () => void;
  osdrStudies: OsdrStudyLiveMetadata[];
  onRefreshOsdr: () => void;
  isRefreshingOsdr: boolean;
}

const MODE_OPTIONS: Array<{
  id: TelemetryMode;
  title: string;
  subtitle: string;
}> = [
  {
    id: "preset",
    title: "Sim Preset",
    subtitle: "Deterministic scenarios for benchmark testing",
  },
  {
    id: "live_hardware",
    title: "Live Hardware",
    subtitle: "100% live ISS ETHOS + crew biometric stream",
  },
  {
    id: "hybrid_overlay",
    title: "Hybrid Fault Overlay",
    subtitle: "Live person vitals + scenario fault injection",
  },
];

export function HardwareBridgeDrawer({
  telemetryMode,
  onChangeTelemetryMode,
  biometricSource,
  onChangeBiometricSource,
  liveVitals,
  onLiveBiometricPatch,
  faultDeltaSummary,
  issSnapshot,
  isRefreshingIss,
  onRefreshIss,
  osdrStudies,
  onRefreshOsdr,
  isRefreshingOsdr,
}: HardwareBridgeDrawerProps) {
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [bleStatus, setBleStatus] = useState<string>(
    "Ready to pair GATT Heart Rate (0x180D)"
  );
  const bleDisconnectRef = useRef<(() => void) | null>(null);

  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [webcamStatus, setWebcamStatus] = useState<string>(
    "Contactless forehead green-channel rPPG scanner"
  );
  const [rppgConfidence, setRppgConfidence] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [apiStatus, setApiStatus] = useState<string>(
    "Ready for /api/telemetry JSON ingest"
  );
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);

  const curlSnippet = `curl -X POST http://localhost:3000/api/telemetry -H "Content-Type: application/json" -d '{"source":"esp32_suit_rig","vitals":{"heartRateBpm":84,"bodyTempC":37.2}}'`;

  useEffect(() => {
    return () => {
      bleDisconnectRef.current?.();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isWebcamActive) return;

    let cancelled = false;
    const sampleBuffer: number[] = [];
    const sampleTimestamps: number[] = [];
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startCamera = async () => {
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          setWebcamStatus("Camera API unavailable in this browser.");
          setIsWebcamActive(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        onChangeBiometricSource("webcam_rppg");
        if (telemetryMode === "preset") {
          onChangeTelemetryMode("live_hardware");
        }
        setWebcamStatus("Sampling facial ROI green channel (keep steady)...");

        intervalId = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState < 2) return;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Sample central facial forehead/cheek ROI (middle 40% x 30%)
          const roiX = Math.floor(canvas.width * 0.3);
          const roiY = Math.floor(canvas.height * 0.2);
          const roiW = Math.floor(canvas.width * 0.4);
          const roiH = Math.floor(canvas.height * 0.35);
          const img = ctx.getImageData(roiX, roiY, roiW, roiH).data;

          let greenSum = 0;
          const pixelCount = img.length / 4;
          for (let i = 1; i < img.length; i += 4) {
            greenSum += img[i];
          }
          const greenMean = pixelCount > 0 ? greenSum / pixelCount : 0;

          const nowMs = performance.now();
          sampleBuffer.push(greenMean);
          sampleTimestamps.push(nowMs);

          if (sampleBuffer.length > 150) {
            sampleBuffer.shift();
            sampleTimestamps.shift();
          }

          if (sampleBuffer.length >= 40) {
            const elapsedSec =
              (sampleTimestamps[sampleTimestamps.length - 1] -
                sampleTimestamps[0]) /
              1000;
            const hz =
              elapsedSec > 0 ? (sampleBuffer.length - 1) / elapsedSec : 20;
            const result = computeRppgHeartRateFromGreenSeries(
              sampleBuffer,
              hz
            );
            setRppgConfidence(result.confidencePct);
            setWebcamStatus(
              `Locked rPPG Pulse: ${result.heartRateBpm} bpm (${result.confidencePct}% SNR)`
            );
            if (result.confidencePct >= 15) {
              onLiveBiometricPatch({ heartRateBpm: result.heartRateBpm });
            }
          }
        }, 50);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Camera permission denied";
        setWebcamStatus(`Webcam rPPG stopped: ${msg}`);
        setIsWebcamActive(false);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [
    isWebcamActive,
    onChangeBiometricSource,
    onChangeTelemetryMode,
    onLiveBiometricPatch,
    telemetryMode,
  ]);

  async function handleConnectBle() {
    if (!isWebBluetoothSupported()) {
      setBleStatus(
        "Web Bluetooth requires Chrome/Edge over HTTPS or localhost."
      );
      return;
    }

    try {
      setBleStatus("Scanning for Bluetooth 0x180D Heart Rate device...");
      bleDisconnectRef.current?.();
      const conn = await connectWebBluetoothHeartRate((reading, name) => {
        setBleDeviceName(name);
        setBleStatus(
          `Connected: ${name} · ${reading.heartRateBpm} bpm (RR ${
            reading.rrIntervalsMs[0] ?? "—"
          } ms)`
        );
        onChangeBiometricSource("web_bluetooth");
        if (telemetryMode === "preset") {
          onChangeTelemetryMode("live_hardware");
        }
        onLiveBiometricPatch({
          heartRateBpm: reading.heartRateBpm,
          bloodPressureSystolic: reading.estimatedSystolicBp,
          bloodPressureDiastolic: reading.estimatedDiastolicBp,
        });
      });
      bleDisconnectRef.current = conn.disconnect;
      setBleDeviceName(conn.deviceName);
      setBleStatus(`Paired to ${conn.deviceName} · Streaming GATT 0x2A37`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pairing cancelled";
      setBleStatus(`BLE Standby (${msg})`);
    }
  }

  async function handleSyncExternalApi() {
    try {
      setApiStatus("Fetching /api/telemetry CHP-IDA packet...");
      const res = await fetch("/api/telemetry");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        source?: string;
        timestampUtc?: string;
        vitals?: Partial<VitalReadings>;
      };
      if (data.vitals) {
        onLiveBiometricPatch(data.vitals);
      }
      onChangeBiometricSource("external_api");
      if (telemetryMode === "preset") {
        onChangeTelemetryMode("live_hardware");
      }
      setApiStatus(
        `Synced from ${data.source ?? "API"} (${data.timestampUtc?.slice(11, 19) ?? "now"} UTC)`
      );
    } catch (err) {
      setApiStatus(
        `API sync error: ${err instanceof Error ? err.message : "failed"}`
      );
    }
  }

  async function handleCopyCurl() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(curlSnippet);
      }
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      setCopiedCurl(true);
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. 3-Mode Telemetry Multiplexer */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              1 · Telemetry Multiplexer (CHP-IDA Bus)
            </span>
            <h3 className="mt-0.5 text-sm font-semibold text-white">
              Combine Live Hardware &amp; Fault Drills
            </h3>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
              telemetryMode === "preset"
                ? "border-white/15 bg-white/5 text-[#9ea3ae]"
                : telemetryMode === "live_hardware"
                ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                : "border-cyan-500/35 bg-cyan-500/15 text-cyan-300"
            }`}
          >
            {telemetryMode === "preset"
              ? "SIM PRESET"
              : telemetryMode === "live_hardware"
              ? "LIVE HARDWARE"
              : "HYBRID OVERLAY"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => {
            const active = telemetryMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`multiplexer-mode-${opt.id}`}
                onClick={() => onChangeTelemetryMode(opt.id)}
                aria-pressed={active}
                className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-cyan-400 bg-cyan-500/15 text-white"
                    : "border-white/10 bg-[#1b1b1b] text-[#9ea3ae] hover:border-white/25 hover:text-white"
                }`}
              >
                <span className="text-xs font-semibold text-white">
                  {opt.title}
                </span>
                <span className="mt-1 text-[10.5px] leading-snug opacity-80">
                  {opt.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {telemetryMode === "hybrid_overlay" && (
          <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3 text-[11px] text-cyan-100">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              Active Hybrid Formula: Live Person Vitals + Fault Delta
            </div>
            <p className="mt-1 text-[#b4b9c4]">
              {faultDeltaSummary.length > 0
                ? `Injecting onto live biometrics: ${faultDeltaSummary.join(" · ")}. Execute Stage 3 countermeasures in the CMO panel to clear this fault while keeping live pulse active.`
                : "Select SANS + CO2, Renal Ca2+, or X-Flare SPE in the top bar to inject a life-support fault onto your live biometric stream."}
            </p>
          </div>
        )}
      </section>

      {/* 2. Crew Biometric Hardware Bridge */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              2 · Crew Biometric Hardware Bridge
            </span>
            <h3 className="mt-0.5 text-sm font-semibold text-white">
              CSA Bio-Monitor / BLE / Webcam rPPG
            </h3>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1b1b1b] px-2.5 py-1 font-mono text-xs text-rose-300">
            <HeartPulse className="h-3.5 w-3.5 animate-pulse" />
            <span>{liveVitals.heartRateBpm} bpm</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {/* Option A: CSA Astroskin 1Hz Stream */}
          <button
            type="button"
            onClick={() => {
              onChangeBiometricSource("astroskin_stream");
              if (telemetryMode === "preset") {
                onChangeTelemetryMode("live_hardware");
              }
            }}
            className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition ${
              biometricSource === "astroskin_stream"
                ? "border-emerald-400 bg-emerald-500/15"
                : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <Activity className="h-3.5 w-3.5 text-emerald-300" />
                CSA Astroskin 1 Hz Bus
              </span>
              {biometricSource === "astroskin_stream" && (
                <span className="font-mono text-[9.5px] text-emerald-300">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-[#8b909a]">
              Simulates continuous Xiphos Q7 / Hexoskin 1 Hz ECG + PTT BP stream
              with zero external hardware.
            </p>
          </button>

          {/* Option B: Web Bluetooth GATT 0x180D */}
          <button
            type="button"
            onClick={handleConnectBle}
            className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition ${
              biometricSource === "web_bluetooth"
                ? "border-cyan-400 bg-cyan-500/15"
                : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <Bluetooth className="h-3.5 w-3.5 text-cyan-300" />
                {bleDeviceName ? bleDeviceName : "Pair Web Bluetooth (BLE)"}
              </span>
              {biometricSource === "web_bluetooth" && (
                <span className="font-mono text-[9.5px] text-cyan-300">
                  GATT LIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-[#8b909a]">{bleStatus}</p>
          </button>

          {/* Option C: Webcam Contactless rPPG */}
          <button
            type="button"
            onClick={() => setIsWebcamActive((prev) => !prev)}
            className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition ${
              isWebcamActive || biometricSource === "webcam_rppg"
                ? "border-violet-400 bg-violet-500/15"
                : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <Camera className="h-3.5 w-3.5 text-violet-300" />
                {isWebcamActive ? "Stop Webcam rPPG" : "Start Webcam rPPG Pulse"}
              </span>
              {isWebcamActive && (
                <span className="font-mono text-[9.5px] text-violet-300">
                  {rppgConfidence}% SNR
                </span>
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-[#8b909a]">{webcamStatus}</p>
          </button>

          {/* Option D: /api/telemetry Hardware Endpoint */}
          <button
            type="button"
            onClick={handleSyncExternalApi}
            className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition ${
              biometricSource === "external_api"
                ? "border-amber-400 bg-amber-500/15"
                : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <Wifi className="h-3.5 w-3.5 text-amber-300" />
                Sync /api/telemetry Ingest
              </span>
              {biometricSource === "external_api" && (
                <span className="font-mono text-[9.5px] text-amber-300">
                  API SYNC
                </span>
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-[#8b909a]">{apiStatus}</p>
          </button>
        </div>

        {/* Hidden/Compact Webcam Preview when active */}
        {isWebcamActive && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-500/25 bg-[#0b0d12] p-2.5">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-16 w-24 rounded-lg border border-white/10 object-cover"
            />
            <canvas ref={canvasRef} width={80} height={60} className="hidden" />
            <div className="min-w-0 flex-1 text-[11px] text-[#b4b9c4]">
              <p className="font-semibold text-white">
                Live Optical Photoplethysmography (rPPG)
              </p>
              <p className="mt-0.5 text-[10.5px] text-[#8b909a]">
                Analyzing micro-changes in facial green-channel hemoglobin
                reflectance (`0.8–2.8 Hz`) to drive the 3D myocardium.
              </p>
            </div>
          </div>
        )}

        {/* Copyable hardware curl ingest snippet */}
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#7e828a]">
              External Suit Rig / ESP32 JSON Push (`POST /api/telemetry`)
            </span>
            <button
              type="button"
              onClick={handleCopyCurl}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/10 bg-[#16181f] px-2 py-0.5 font-mono text-[9.5px] text-white hover:border-white/25"
            >
              {copiedCurl ? (
                <>
                  <Check className="h-2.5 w-2.5 text-emerald-300" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-2.5 w-2.5" />
                  Copy curl
                </>
              )}
            </button>
          </div>
          <code className="mt-1.5 block overflow-x-auto whitespace-nowrap font-mono text-[10px] text-cyan-200/85">
            {curlSnippet}
          </code>
        </div>
      </section>

      {/* 3. Live ISS Orbital / ETHOS Symbols & NASA OSDR Metadata */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              3 · Live ISS Orbital &amp; ETHOS Telemetry
            </span>
            <h3 className="mt-0.5 text-sm font-semibold text-white">
              USLAB / NODE3 / HERA Environmental Feed
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefreshIss}
            disabled={isRefreshingIss}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-[#1b1b1b] px-2.5 py-1 text-[10.5px] font-medium text-white hover:border-white/25 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRefreshingIss ? "animate-spin" : ""}`}
            />
            <span>Refresh ISS</span>
          </button>
        </div>

        {issSnapshot && (
          <div className="mt-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0b0d12] px-3 py-2 font-mono text-[10.5px]">
              <Satellite className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-white">
                LAT {issSnapshot.orbital.latitude}° · LON{" "}
                {issSnapshot.orbital.longitude}°
              </span>
              <span className="text-[#8b909a]">
                ALT {issSnapshot.orbital.altitudeKm} km ·{" "}
                {issSnapshot.orbital.velocityKmh.toLocaleString()} km/h
              </span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                  issSnapshot.orbital.inSouthAtlanticAnomaly
                    ? "bg-rose-500/20 text-rose-300"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {issSnapshot.orbital.inSouthAtlanticAnomaly
                  ? "SAA PROTON BELT"
                  : "SAA CLEAR"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.values(issSnapshot.symbols).map((sym) => (
                <div
                  key={sym.symbol}
                  className="rounded-xl border border-white/[0.07] bg-[#1b1b1b] p-2"
                >
                  <div className="flex items-center justify-between gap-1 font-mono text-[9px] text-[#7e828a]">
                    <span>{sym.symbol}</span>
                    <span>{sym.nominalRange}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-[#b4b9c4]">
                    {sym.label}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-white">
                    {sym.value} {sym.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NASA OSDR Study Metadata */}
        <div className="mt-4 border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[#7e828a]">
              <Database className="h-3 w-3 text-cyan-300" />
              NASA OSDR Studies (`osdr.nasa.gov/osdr/data/osd/meta`)
            </span>
            <button
              type="button"
              onClick={onRefreshOsdr}
              disabled={isRefreshingOsdr}
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] text-cyan-300 hover:text-cyan-200"
            >
              <RefreshCw
                className={`h-2.5 w-2.5 ${isRefreshingOsdr ? "animate-spin" : ""}`}
              />
              Sync OSDR
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {osdrStudies.map((study) => (
              <a
                key={study.studyId}
                href={study.osdrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#1b1b1b] p-2.5 transition hover:border-white/20"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold text-cyan-300">
                      {study.studyId}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[8.5px] text-[#8b909a]">
                      {study.source === "nasa_osdr_live" ? "LIVE API" : "CACHED"}
                    </span>
                    <span className="truncate font-mono text-[9.5px] text-[#7e828a]">
                      {study.missionName} · {study.sampleCount} samples
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-white">
                    {study.title}
                  </p>
                </div>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[#7e828a]" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Official NASA & CSA Hardware Compatibility Matrix */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-300" />
          <div>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
              4 · Flight Hardware Compatibility Spec
            </span>
            <h3 className="text-sm font-semibold text-white">
              Official NASA &amp; CSA Sensors Mapped to ARES-MED
            </h3>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {NASA_FLIGHT_HARDWARE_SPECS.map((hw) => (
            <div
              key={hw.id}
              className="rounded-xl border border-white/[0.07] bg-[#1b1b1b] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  {hw.name}
                </span>
                <span className="shrink-0 rounded-full border border-white/10 bg-[#141414] px-2 py-0.5 font-mono text-[9.5px] text-cyan-300">
                  {hw.agency}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-[#8b909a]">
                <Radio className="mr-1 inline h-2.5 w-2.5 text-amber-300" />
                {hw.telemetrySymbolOrProtocol}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[#b4b9c4]">
                {hw.clinicalRole}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {hw.mappedMetrics.map((metric) => (
                  <span
                    key={metric}
                    className="rounded border border-white/10 bg-[#141414] px-1.5 py-0.5 font-mono text-[9px] text-emerald-300"
                  >
                    {metric}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

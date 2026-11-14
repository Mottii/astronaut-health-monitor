"use client";

import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";

export default function OrbitalAscentPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05050A]">
      <iframe
        src="/orbital/index.html"
        title="ORBITAL ASCENT // Earth to ISS 3D Experience"
        className="h-full w-full border-0"
        allow="autoplay; fullscreen"
      />

      <div className="pointer-events-none fixed top-5 left-5 z-50 flex items-center gap-2.5 sm:top-7 sm:left-7">
        <Link
          href="/"
          className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-lg border border-white/25 bg-[#06070a]/75 px-3.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-white backdrop-blur-md transition hover:border-white hover:bg-white hover:text-[#06070a]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>ARES-MED BIOTWIN</span>
        </Link>
        <Link
          href="/preflight"
          className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-400/30 bg-[#06070a]/75 px-3.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-cyan-200 backdrop-blur-md transition hover:border-cyan-300 hover:bg-cyan-400/20"
        >
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          <span>PRE-FLIGHT LAB</span>
        </Link>
      </div>
    </div>
  );
}

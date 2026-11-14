"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrbitalAscentPage() {
  const router = useRouter();

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (
        e.data?.type === "ARES_ENTER_BIOTWIN" ||
        e.data?.type === "ARES_OPEN_CONSOLE"
      ) {
        router.push("/");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#06070a]">
      <iframe
        src="/orbital/index.html"
        title="ORBITAL ASCENT // Earth to ISS 3D Experience"
        className="h-full w-full border-0 bg-[#06070a]"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}

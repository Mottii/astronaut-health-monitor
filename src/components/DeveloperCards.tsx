"use client";

import { useEffect, useRef } from "react";
import { DEVELOPERS } from "@/data/developers";
import { samplePortraitProximity } from "@/lib/portraitProximity";

export function DeveloperCards() {
  const teamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const team = teamRef.current;
    if (!team || !window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches) return;
    const portraits = Array.from(team.querySelectorAll<HTMLElement>(".ares-developer-avatar"));
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    const clear = () => {
      pointer = null;
      portraits.forEach((portrait) => portrait.style.setProperty("--portrait-proximity", "0"));
    };
    const update = () => {
      frame = 0;
      const story = team.closest<HTMLElement>(".ares-story");
      if (!pointer || team.closest("[inert]") || (story && story.dataset.slide !== "title")) { clear(); return; }
      const teamBounds = team.getBoundingClientRect();
      if (teamBounds.bottom < 0 || teamBounds.top > window.innerHeight) { clear(); return; }
      for (const portrait of portraits) {
        const sample = samplePortraitProximity(pointer.x, pointer.y, portrait.getBoundingClientRect());
        portrait.style.setProperty("--portrait-cursor-x", `${sample.x}px`);
        portrait.style.setProperty("--portrait-cursor-y", `${sample.y}px`);
        portrait.style.setProperty("--portrait-proximity", String(sample.strength));
      }
    };
    const schedule = () => { if (pointer && !frame) frame = requestAnimationFrame(update); };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") { clear(); return; }
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) clear(); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", clear);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", schedule, true);
    };
  }, []);

  return (
    <div ref={teamRef} className="ares-title-team">
      <div className="ares-title-team-heading">
        <span>DEVELOPMENT TEAM</span>
      </div>
      <ul className="ares-developer-grid" aria-label="Development team">
        {DEVELOPERS.map((developer) => (
          <li key={developer.id}>
            <article className="ares-developer-card">
              {developer.avatar && <div className="ares-developer-avatar">
                <img src={developer.avatar} alt="" width={160} height={160} style={{ objectPosition: developer.avatarPosition }} decoding="async"
                  onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                <img className="ares-developer-color" src={developer.avatar} alt="" aria-hidden="true" width={160} height={160}
                  style={{ objectPosition: developer.avatarPosition }} decoding="async"
                  onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                <span className="ares-developer-fog" aria-hidden="true" />
              </div>}
              <h3>{developer.nickname}</h3>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

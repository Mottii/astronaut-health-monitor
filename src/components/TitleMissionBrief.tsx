import { ArrowUpRight } from "lucide-react";

const CAPABILITIES = [
  { title: "Monitor", description: "Bring crew vitals and cabin conditions into one view." },
  { title: "Understand", description: "Explore how changes in one body system affect another." },
  { title: "Act", description: "Follow guided self-exams and mission-specific countermeasures." },
];

export function TitleMissionBrief({ onOpenConsole }: { onOpenConsole: () => void }) {
  return (
    <aside className="ares-title-brief" aria-label="About ARES-MED">
      <div className="ares-title-brief-kicker"><span>THE MISSION</span><span>01 / OVERVIEW</span></div>
      <h2>Care, even when<br />Earth is out of reach.</h2>
      <p className="ares-title-brief-description">Deep-space crews need a clear picture of their health. ARES-MED connects a human digital twin with health monitoring and guided decisions, wherever the mission leads.</p>
      <ol className="ares-title-capabilities">
        {CAPABILITIES.map((capability, index) => (
          <li key={capability.title}>
            <span className="ares-title-capability-index" aria-hidden="true">0{index + 1}</span>
            <div><h3>{capability.title}</h3><p>{capability.description}</p></div>
          </li>
        ))}
      </ol>
      <button type="button" className="ares-story-action" onClick={onOpenConsole}>EXPLORE THE CONSOLE <ArrowUpRight size={15} aria-hidden="true" /></button>
      <div className="ares-title-brief-source">RESEARCH PROTOTYPE / NASA HRP + OSDR</div>
    </aside>
  );
}

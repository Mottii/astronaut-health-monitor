import { MISSION_ENVIRONMENTS, DEMO_SCENARIOS } from "@/data/nasaHrpData";

export default function HomePage() {
  const defaultScenario = DEMO_SCENARIOS[0];
  const env = MISSION_ENVIRONMENTS[defaultScenario.environmentId];

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-bold tracking-tight text-cyan-400">
        ARES-MED OS — BioTwin Cascade &amp; Autonomous CMO Console
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        Initialized for {env.name} ({env.gravityLabel} · {env.commDelayLabel}).
      </p>
    </main>
  );
}

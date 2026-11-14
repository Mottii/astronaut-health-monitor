"use client";

import React from "react";
import {
  ArrowUpRight,
  Award,
  CheckSquare,
  Clock,
  Flame,
  RotateCcw,
  Square,
} from "lucide-react";
import { BODY_SYSTEM_METADATA } from "@/data/nasaHrpData";
import type {
  BodySystemId,
  RoutineProgressState,
  RoutineTask,
} from "@/types/health";

export interface RoutineGamificationBarProps {
  tasks: RoutineTask[];
  progress: RoutineProgressState;
  onToggleTask: (taskId: string) => void;
  onResetDay: () => void;
  onSelectSystem?: (system: BodySystemId) => void;
}

const SYSTEM_DOT_COLOR: Record<BodySystemId, string> = {
  neuro_ocular: "#2dd4bf",
  behavioral_circadian: "#818cf8",
  cardiovascular: "#fb7185",
  immune_hematology: "#c084fc",
  metabolic_endocrine: "#f97316",
  musculoskeletal_renal: "#4ade80",
};

function getCrewRankLabel(xp: number): string {
  if (xp >= 115) {
    return "Tier 3 · Autonomous CMO";
  }
  if (xp >= 60) {
    return "Tier 2 · Crew Medical Specialist";
  }
  return "Tier 1 · Flight Cadet";
}

export function RoutineGamificationBar({
  tasks,
  progress,
  onToggleTask,
  onResetDay,
  onSelectSystem,
}: RoutineGamificationBarProps) {
  const completedSet = new Set(progress.completedTaskIds);
  const totalXp = tasks.reduce((sum, task) => sum + task.xp, 0);
  const completedCount = tasks.filter((task) => completedSet.has(task.id)).length;
  const pct =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const rankLabel = getCrewRankLabel(progress.xp);

  return (
    <section
      aria-label="Daily Countermeasure Routine and Crew Adherence"
      className="rounded-3xl border border-white/[0.08] bg-[#1a1a1a] p-6 sm:p-8"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7e828a]">
            Crew Habit &amp; Preventative Adherence
          </p>
          <h2 className="mt-1.5 text-2xl font-medium tracking-tight text-white sm:text-3xl">
            Daily Countermeasure Protocols
          </h2>
          <p className="mt-1 text-sm text-[#7e828a]">
            {completedCount} of {tasks.length} spaceflight countermeasures
            verified today ({pct}% complete)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 font-mono text-xs font-medium text-amber-300">
            <Flame className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            {progress.streakSols} Sol Streak
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#141414] px-3.5 py-1.5 font-mono text-xs font-medium text-white">
            <Award className="h-3.5 w-3.5 text-[#7e828a]" aria-hidden="true" />
            {progress.xp} / {totalXp} XP · {rankLabel}
          </span>

          <button
            type="button"
            onClick={onResetDay}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#202020] px-3.5 py-1.5 text-xs font-medium text-white transition hover:border-white/25 hover:bg-[#2b2b2b] active:scale-[0.98]"
          >
            <RotateCcw className="h-3 w-3 text-[#7e828a]" aria-hidden="true" />
            Reset Sol Checklist
          </button>
        </div>
      </div>

      {/* Monochrome-to-Emerald Progress Track */}
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[#141414]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            pct === 100
              ? "bg-[#4ade80]"
              : "bg-gradient-to-r from-white to-[#4ade80]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Interactive 5-Task Countermeasure Cards */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {tasks.map((task) => {
          const done = completedSet.has(task.id);
          const systemMeta = BODY_SYSTEM_METADATA[task.category];
          const dotColor = SYSTEM_DOT_COLOR[task.category];

          return (
            <div
              key={task.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                done
                  ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                  : "border-white/[0.07] bg-[#141414] hover:border-white/15"
              }`}
            >
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#1b1b1b] px-2.5 py-0.5 text-[10px] font-medium text-[#7e828a]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    {systemMeta.shortLabel}
                  </span>

                  <span className="font-mono text-[10px] font-medium text-white">
                    +{task.xp} XP
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  aria-pressed={done}
                  className="flex w-full items-start gap-2.5 text-left"
                >
                  {done ? (
                    <CheckSquare
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#4ade80]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#7e828a]"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`text-xs font-medium leading-snug ${
                      done ? "text-emerald-200 line-through" : "text-white"
                    }`}
                  >
                    {task.title}
                  </span>
                </button>

                <p className="mt-2 text-[11px] leading-relaxed text-[#7e828a]">
                  {task.nasaProtocolNote}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#7e828a]">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {task.durationMin}m
                </span>

                {onSelectSystem && (
                  <button
                    type="button"
                    onClick={() => onSelectSystem(task.category)}
                    title={`Inspect ${systemMeta.name} in BioTwin & CMO Panel`}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-white transition hover:text-[#7e828a]"
                  >
                    <span>Inspect</span>
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

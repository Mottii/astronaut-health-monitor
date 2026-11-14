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
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            Daily Countermeasure Adherence
          </p>
          <h2 className="text-sm font-semibold text-slate-100">
            Crew Habit &amp; Preventative Protocol Checklist ({completedCount}/
            {tasks.length} Complete · {pct}%)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
            <Flame className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            {progress.streakSols} Sol Streak
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
            <Award className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            {progress.xp} / {totalXp} XP · {rankLabel}
          </span>

          <button
            type="button"
            onClick={onResetDay}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset Sol Checklist
          </button>
        </div>
      </div>

      {/* XP Completion Progress Bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-950">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Interactive 5-Task Countermeasure Cards */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-5">
        {tasks.map((task) => {
          const done = completedSet.has(task.id);
          const systemMeta = BODY_SYSTEM_METADATA[task.category];
          return (
            <div
              key={task.id}
              className={`flex flex-col justify-between rounded-lg border p-3 transition ${
                done
                  ? "border-emerald-500/50 bg-emerald-950/25"
                  : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
              }`}
            >
              <div>
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  aria-pressed={done}
                  className="flex w-full items-start gap-2 text-left"
                >
                  {done ? (
                    <CheckSquare
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`text-xs font-semibold leading-snug ${
                      done ? "text-emerald-200 line-through" : "text-slate-100"
                    }`}
                  >
                    {task.title}
                  </span>
                </button>

                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  {task.nasaProtocolNote}
                </p>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800/70 pt-2">
                <div className="flex items-center gap-2 text-[10px] font-medium">
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-cyan-300">
                    +{task.xp} XP
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {task.durationMin}m
                  </span>
                </div>

                {onSelectSystem && (
                  <button
                    type="button"
                    onClick={() => onSelectSystem(task.category)}
                    title={`Inspect ${systemMeta.name} in BioTwin & CMO Panel`}
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-cyan-300 hover:text-cyan-200 hover:underline"
                  >
                    <span>{systemMeta.shortLabel}</span>
                    <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
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

import { DEFAULT_ROUTINE_TASKS } from "@/data/nasaHrpData";
import type { RoutineProgressState, RoutineTask } from "@/types/health";

export const ROUTINE_STORAGE_KEY = "ares_med_routine_v1";
export const BASE_STREAK_SOLS = 12;

export const DEFAULT_ROUTINE_PROGRESS: RoutineProgressState = {
  completedTaskIds: [],
  xp: 0,
  streakSols: BASE_STREAK_SOLS,
  lastUpdatedIso: "2026-11-14T00:00:00.000Z",
};

function createFreshDefaultProgress(): RoutineProgressState {
  return {
    ...DEFAULT_ROUTINE_PROGRESS,
    completedTaskIds: [],
  };
}

/**
 * Loads crew routine adherence progress from localStorage (or an injected Storage mock).
 * Safely recovers to clean default state if SSR, missing, or corrupted JSON.
 */
export function loadRoutineProgress(
  storage?: Pick<Storage, "getItem">
): RoutineProgressState {
  let targetStorage: Pick<Storage, "getItem"> | undefined = storage;
  if (!targetStorage && typeof window !== "undefined") {
    try {
      targetStorage = window.localStorage;
    } catch {
      return createFreshDefaultProgress();
    }
  }

  if (!targetStorage) {
    return createFreshDefaultProgress();
  }

  try {
    const raw = targetStorage.getItem(ROUTINE_STORAGE_KEY);
    if (!raw) {
      return createFreshDefaultProgress();
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return createFreshDefaultProgress();
    }

    const record = parsed as Record<string, unknown>;
    if (
      !Array.isArray(record.completedTaskIds) ||
      typeof record.xp !== "number" ||
      !Number.isFinite(record.xp) ||
      record.xp < 0 ||
      typeof record.streakSols !== "number" ||
      !Number.isFinite(record.streakSols) ||
      record.streakSols < 0
    ) {
      return createFreshDefaultProgress();
    }

    const completedTaskIds = Array.from(
      new Set(
        record.completedTaskIds.filter(
          (item): item is string => typeof item === "string"
        )
      )
    );

    const lastUpdatedIso =
      typeof record.lastUpdatedIso === "string"
        ? record.lastUpdatedIso
        : DEFAULT_ROUTINE_PROGRESS.lastUpdatedIso;

    return {
      completedTaskIds,
      xp: record.xp,
      streakSols: record.streakSols,
      lastUpdatedIso,
    };
  } catch {
    return createFreshDefaultProgress();
  }
}

/**
 * Toggles completion of a mission routine task and recalculates XP & Sol streak
 * deterministically from the task catalog so XP is never double-counted.
 */
export function toggleRoutineTask(
  state: RoutineProgressState,
  taskId: string,
  tasks: RoutineTask[] = DEFAULT_ROUTINE_TASKS
): RoutineProgressState {
  const existingSet = new Set(state.completedTaskIds);
  if (existingSet.has(taskId)) {
    existingSet.delete(taskId);
  } else {
    existingSet.add(taskId);
  }

  const nextCompletedIds = Array.from(existingSet);
  const xp = tasks.reduce(
    (sum, task) => (existingSet.has(task.id) ? sum + task.xp : sum),
    0
  );
  const streakSols =
    nextCompletedIds.length > 0 ? BASE_STREAK_SOLS + 1 : BASE_STREAK_SOLS;

  return {
    completedTaskIds: nextCompletedIds,
    xp,
    streakSols,
    lastUpdatedIso: new Date().toISOString(),
  };
}

/**
 * Persists crew routine progress to localStorage (or an injected Storage mock).
 */
export function saveRoutineProgress(
  state: RoutineProgressState,
  storage?: Pick<Storage, "setItem">
): void {
  let targetStorage: Pick<Storage, "setItem"> | undefined = storage;
  if (!targetStorage && typeof window !== "undefined") {
    try {
      targetStorage = window.localStorage;
    } catch {
      return;
    }
  }

  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Swallow quota/private-mode storage exceptions cleanly in client UI
  }
}

/**
 * Resets completed tasks and daily XP for a new Sol while preserving base streak.
 */
export function resetRoutineDay(): RoutineProgressState {
  return {
    completedTaskIds: [],
    xp: 0,
    streakSols: BASE_STREAK_SOLS,
    lastUpdatedIso: new Date().toISOString(),
  };
}

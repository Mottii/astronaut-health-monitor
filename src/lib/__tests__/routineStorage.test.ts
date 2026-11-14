import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTINE_TASKS } from "@/data/nasaHrpData";
import {
  BASE_STREAK_SOLS,
  DEFAULT_ROUTINE_PROGRESS,
  ROUTINE_STORAGE_KEY,
  loadRoutineProgress,
  resetRoutineDay,
  saveRoutineProgress,
  toggleRoutineTask,
} from "@/lib/routineStorage";

describe("routineStorage", () => {
  it("returns clean default state when storage is empty, missing, or corrupted", () => {
    expect(loadRoutineProgress(undefined)).toEqual({
      ...DEFAULT_ROUTINE_PROGRESS,
      completedTaskIds: [],
      xp: 0,
      streakSols: BASE_STREAK_SOLS,
    });

    const emptyStorage = { getItem: () => null };
    expect(loadRoutineProgress(emptyStorage).completedTaskIds).toEqual([]);
    expect(loadRoutineProgress(emptyStorage).xp).toBe(0);
    expect(loadRoutineProgress(emptyStorage).streakSols).toBe(12);

    const corruptedStorage = { getItem: () => "{not-valid-json" };
    const recovered = loadRoutineProgress(corruptedStorage);
    expect(recovered.completedTaskIds).toEqual([]);
    expect(recovered.xp).toBe(0);
    expect(recovered.streakSols).toBe(12);
  });

  it("toggles tasks idempotently without double-counting XP and updates Sol streak", () => {
    const initial = loadRoutineProgress(undefined);
    const afterAred = toggleRoutineTask(initial, "ared_load", DEFAULT_ROUTINE_TASKS);
    expect(afterAred.completedTaskIds).toEqual(["ared_load"]);
    expect(afterAred.xp).toBe(40);
    expect(afterAred.streakSols).toBe(13);

    // Checking a second task adds its XP while keeping Sol streak at 13 for the current Sol
    const afterSecond = toggleRoutineTask(
      afterAred,
      "amsler_ocular",
      DEFAULT_ROUTINE_TASKS
    );
    expect(afterSecond.completedTaskIds).toEqual(["ared_load", "amsler_ocular"]);
    expect(afterSecond.xp).toBe(65);
    expect(afterSecond.streakSols).toBe(13);

    // Unchecking subtracts XP accurately
    const afterUncheckAred = toggleRoutineTask(
      afterSecond,
      "ared_load",
      DEFAULT_ROUTINE_TASKS
    );
    expect(afterUncheckAred.completedTaskIds).toEqual(["amsler_ocular"]);
    expect(afterUncheckAred.xp).toBe(25);
    expect(afterUncheckAred.streakSols).toBe(13);

    // Unchecking final task restores 0 XP and base streak
    const afterUncheckAll = toggleRoutineTask(
      afterUncheckAred,
      "amsler_ocular",
      DEFAULT_ROUTINE_TASKS
    );
    expect(afterUncheckAll.completedTaskIds).toEqual([]);
    expect(afterUncheckAll.xp).toBe(0);
    expect(afterUncheckAll.streakSols).toBe(12);
  });

  it("saves progress under ROUTINE_STORAGE_KEY and round-trips via loadRoutineProgress", () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    const updated = toggleRoutineTask(
      DEFAULT_ROUTINE_PROGRESS,
      "renal_hydration",
      DEFAULT_ROUTINE_TASKS
    );
    saveRoutineProgress(updated, mockStorage);

    expect(store.has(ROUTINE_STORAGE_KEY)).toBe(true);
    const reloaded = loadRoutineProgress(mockStorage);
    expect(reloaded.completedTaskIds).toEqual(["renal_hydration"]);
    expect(reloaded.xp).toBe(30);
    expect(reloaded.streakSols).toBe(13);
  });

  it("resets completed tasks and XP while keeping base streak", () => {
    const reset = resetRoutineDay();
    expect(reset.completedTaskIds).toEqual([]);
    expect(reset.xp).toBe(0);
    expect(reset.streakSols).toBe(12);
  });
});

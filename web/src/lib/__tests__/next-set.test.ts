import { describe, it, expect } from "vitest";
import { nextSetSummary, weightAndReps } from "../next-set";
import type { ActiveSession, ResolvedExercise } from "../types";

const ex = (o: Partial<ResolvedExercise>): ResolvedExercise => ({
  id: "bench", definitionId: "d", order: 1, name: "Bench", muscleGroups: [], phase: "main", equipmentType: "barbell_45",
  equipmentDetail: null, progressionRule: "add_5lb", isUnilateral: false, isTimeBased: false, currentWeight: 135, hardStreak: 0,
  sets: 3, repMin: 8, repMax: { type: "count", value: 10 }, restSeconds: 90, notes: null, ...o,
});
const session = (o: Partial<ActiveSession> = {}): ActiveSession => ({
  workout: { id: "w", programId: "p", programName: "P", week: 1, dayOfWeek: "Mon", exercises: [ex({}), ex({ id: "row", order: 2, name: "Row", isTimeBased: false, equipmentType: "bodyweight", repMin: 12, repMax: { type: "count", value: 12 } })] },
  resolvedWeights: { bench: 135, row: 0 }, currentExerciseIndex: 0, currentSetNumber: 2,
  completedSets: [{ exerciseOrder: 1 } as never], isResting: true, restTimeRemaining: 60, startTime: new Date(), prsAchieved: [], ...o,
});

describe("nextSetSummary", () => {
  it("describes the next set of the same exercise with its weight and reps", () => {
    expect(nextSetSummary(session())).toEqual({ label: "Next Set", detail: "Bench - Set 2 of 3", weight: 135, reps: "8–10 reps" });
  });
  it("describes the first set of the next exercise", () => {
    const s = nextSetSummary(session({ currentExerciseIndex: 1, currentSetNumber: 1 }))!;
    expect(s.label).toBe("Up Next");
    expect(s.detail).toBe("Row - Set 1 of 3");
    expect(weightAndReps(s)).toBe("12 reps");
  });
  it("uses a custom set's own reps and weight", () => {
    const s = nextSetSummary(session({ insertedSet: { exerciseId: "bench", reps: 5, weight: 115 } }))!;
    expect(weightAndReps(s)).toBe("115 lb · 5 reps");
  });
  it("shows AMRAP for the final AMRAP set", () => {
    const s = nextSetSummary(session({ currentSetNumber: 3, workout: { ...session().workout, exercises: [ex({ lastSetAmrap: true })] } }))!;
    expect(s.reps).toBe("AMRAP");
  });
});

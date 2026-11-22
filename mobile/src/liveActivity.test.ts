import { describe, expect, it } from "vitest";
import { liveActivityState } from "./liveActivity";
import type { WorkoutMirrorState } from "./messages";

const base: WorkoutMirrorState = {
  exercise: "Bench Press", set: 2, sets: 4, weight: 135, restEndsAt: null, restSeconds: 90,
  notify: true, nextLabel: "Next Set", nextDetail: "Bench Press - Set 2",
};

describe("liveActivityState", () => {
  it("counts down to the end of rest while resting", () => {
    const state = liveActivityState({ ...base, restEndsAt: 61_000 }, 1_000);
    expect(state.title).toBe("Rest");
    expect(state.subtitle).toBe("Next Set: Bench Press - Set 2");
    expect(state.progressBar).toEqual({ date: 61_000 });
  });

  it("shows the current set and progress through the exercise when not resting", () => {
    const state = liveActivityState(base, 1_000);
    expect(state.title).toBe("Bench Press");
    expect(state.subtitle).toBe("Set 2 of 4 · 135 lb");
    expect(state.progressBar).toEqual({ progress: 0.25 });
  });

  it("omits the weight for bodyweight exercises", () => {
    expect(liveActivityState({ ...base, weight: 0 }, 0).subtitle).toBe("Set 2 of 4");
  });

  it("treats a rest end time that has already passed as not resting", () => {
    expect(liveActivityState({ ...base, restEndsAt: 500 }, 1_000).title).toBe("Bench Press");
  });

  it("falls back to a plain subtitle when there is no next step during rest", () => {
    const state = liveActivityState({ ...base, restEndsAt: 61_000, nextLabel: "", nextDetail: "" }, 1_000);
    expect(state.subtitle).toBe("Catch your breath");
  });
});

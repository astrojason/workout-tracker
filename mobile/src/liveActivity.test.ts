import { describe, expect, it } from "vitest";
import { liveActivityState, planLiveActivity } from "./liveActivity";
import type { WorkoutMirrorState } from "./messages";

const base: WorkoutMirrorState = {
  exercise: "Bench Press", set: 2, sets: 4, weight: 135, restEndsAt: null, restSeconds: 90,
  notify: true, nextLabel: "Next Set", nextDetail: "Bench Press - Set 2 of 4", reps: "8–10 reps",
};

describe("liveActivityState", () => {
  it("counts down to the end of rest while resting", () => {
    const state = liveActivityState({ ...base, restEndsAt: 61_000 }, 1_000);
    expect(state.title).toBe("Rest");
    expect(state.subtitle).toBe("Next Set: Bench Press - Set 2 of 4 · 135 lb · 8–10 reps");
    expect(state.progressBar).toEqual({ date: 61_000 });
  });

  it("shows the current set and progress through the exercise when not resting", () => {
    const state = liveActivityState(base, 1_000);
    expect(state.title).toBe("Bench Press");
    expect(state.subtitle).toBe("Set 2 of 4 · 135 lb · 8–10 reps");
    expect(state.progressBar).toEqual({ progress: 0.25 });
  });

  it("omits the weight for bodyweight exercises", () => {
    expect(liveActivityState({ ...base, weight: 0 }, 0).subtitle).toBe("Set 2 of 4 · 8–10 reps");
  });

  it("treats a rest end time that has already passed as not resting", () => {
    expect(liveActivityState({ ...base, restEndsAt: 500 }, 1_000).title).toBe("Bench Press");
  });

  it("falls back to a plain subtitle when there is no next step during rest", () => {
    const state = liveActivityState({ ...base, restEndsAt: 61_000, nextLabel: "", nextDetail: "" }, 1_000);
    expect(state.subtitle).toBe("Catch your breath");
  });
});

describe("planLiveActivity", () => {
  it("keeps updating the activity it started while that activity is still running", () => {
    expect(planLiveActivity(["a"], "a", true)).toEqual({ keep: "a", stop: [], start: false });
  });

  it("adopts the running activity after the app was relaunched and forgot its id", () => {
    expect(planLiveActivity(["old"], undefined, true)).toEqual({ keep: "old", stop: [], start: false });
  });

  it("ends extra activities left over from an earlier launch", () => {
    expect(planLiveActivity(["old", "a"], "a", true)).toEqual({ keep: "a", stop: ["old"], start: false });
  });

  it("starts a new activity when the remembered one was swiped away", () => {
    expect(planLiveActivity([], "gone", true)).toEqual({ keep: undefined, stop: [], start: true });
  });

  it("starts an activity when none is running", () => {
    expect(planLiveActivity([], undefined, true)).toEqual({ keep: undefined, stop: [], start: true });
  });

  it("ends every running activity when the workout ends, including forgotten ones", () => {
    expect(planLiveActivity(["old", "a"], "a", false)).toEqual({ keep: undefined, stop: ["old", "a"], start: false });
  });
});

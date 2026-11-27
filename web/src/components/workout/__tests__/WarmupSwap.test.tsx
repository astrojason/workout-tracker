import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveWorkout } from "../ActiveWorkout";
import { RestTimer } from "../RestTimer";
import type { ActiveSession, ResolvedExercise } from "@/lib/types";

vi.mock("@/hooks/useSound", () => ({
  useSound: () => ({ playTimerComplete: vi.fn(), playSetComplete: vi.fn(), initAudio: vi.fn() }),
}));

const base: ResolvedExercise = {
  id: "x", definitionId: "x", order: 1, name: "X", muscleGroups: [], phase: "main", equipmentType: "bodyweight",
  equipmentDetail: null, progressionRule: "none", isUnilateral: false, isTimeBased: false, currentWeight: 0,
  hardStreak: 0, sets: 3, repMin: 12, repMax: { type: "count", value: 12 }, restSeconds: 150, notes: null,
};
const band = { ...base, id: "p-sub-1", definitionId: "band", name: "Banded Chest Press", phase: "warmup" as const, sets: 1, equipmentType: "band" as const, equipmentDetail: "Blue", restSeconds: 60, restAfter: 60 };
const incline = { ...band, id: "p-sub-2", definitionId: "incline", name: "Incline Push-up", equipmentType: "bodyweight" as const, equipmentDetail: null };
const pushup = { ...base, id: "p", definitionId: "pushup", name: "Push-up", order: 2 };

function session(exercises: ResolvedExercise[], o: Partial<ActiveSession> = {}): ActiveSession {
  return {
    workout: { id: "w", programId: "p", programName: "Program", week: 1, dayOfWeek: "Thursday", exercises },
    resolvedWeights: Object.fromEntries(exercises.map((e) => [e.id, e.currentWeight])),
    currentExerciseIndex: 0, currentSetNumber: 1, completedSets: [], isResting: false, restTimeRemaining: 0,
    startTime: new Date(), prsAchieved: [], ...o,
  };
}

function renderWorkout(s: ActiveSession, onSwapWarmup = vi.fn()) {
  render(
    <ActiveWorkout session={s} onCompleteSet={vi.fn()} onSkipSet={vi.fn()} onSkipRest={vi.fn()} onEndWorkout={vi.fn()}
      onUpdateWeight={vi.fn()} onUpdateSets={vi.fn()} onInsertSet={vi.fn()} onDismiss={vi.fn()} onPause={vi.fn()} onSwapWarmup={onSwapWarmup} />,
  );
  return onSwapWarmup;
}

describe("lighter-movement warm-ups during a workout", () => {
  it("offers the other lighter movements and swaps to the one picked", () => {
    const options = [band, incline];
    const onSwap = renderWorkout(session([{ ...band, warmupOptions: options }, pushup]));
    const select = screen.getByLabelText("Warm up with") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Banded Chest Press (Blue)", "Incline Push-up"]);
    fireEvent.change(select, { target: { value: "p-sub-2" } });
    expect(onSwap).toHaveBeenCalledWith("p-sub-2");
  });

  it("offers no swap for a warm-up with a single option", () => {
    renderWorkout(session([{ ...band, warmupOptions: [band] }, pushup]));
    expect(screen.queryByLabelText("Warm up with")).toBeNull();
  });

  it("shows the active-stretch tip on a lift that gets no warm-up", () => {
    renderWorkout(session([{ ...pushup, warmupTip: "Arm circles and band dislocates, 30s" }]));
    expect(screen.getByRole("note")).toHaveTextContent("No lighter warm-up fits. Before your first set: Arm circles and band dislocates, 30s");
  });
});

describe("rest ring", () => {
  it("measures progress against the rest that's running, not the next exercise's rest", () => {
    // A 60s warm-up rest, 30s left, before a lift whose own rest is 150s: the ring is half full.
    const { container } = render(
      <RestTimer session={session([band, pushup], { currentExerciseIndex: 1, isResting: true, restTimeRemaining: 30, restTotal: 60 })} onSkipRest={vi.fn()} />,
    );
    const ring = container.querySelectorAll("circle")[1];
    const c = 2 * Math.PI * 54;
    expect(Number(ring.getAttribute("stroke-dashoffset"))).toBeCloseTo(c * 0.5, 3);
  });
});

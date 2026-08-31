import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExerciseCard } from "../ExerciseCard";
import type { EquipmentDisplay, ResolvedExercise } from "@/lib/types";

const exercise: ResolvedExercise = {
  id: "exercise-1",
  definitionId: "definition-1",
  order: 1,
  name: "Bench Press",
  muscleGroups: ["Chest"],
  phase: "main",
  equipmentType: "barbell_45",
  equipmentDetail: null,
  progressionRule: "add_5lb",
  isUnilateral: false,
  isTimeBased: false,
  currentWeight: 155,
  hardStreak: 0,
  sets: 3,
  repMin: 8,
  repMax: { type: "count", value: 10 },
  restSeconds: 120,
  notes: null,
};

function renderCard(equipmentDisplay: EquipmentDisplay) {
  render(
    <ExerciseCard
      exercise={exercise}
      setNumber={1}
      weight={155}
      equipmentDisplay={equipmentDisplay}
    />,
  );
  return screen.getByRole("group", { name: "Plate loading instructions" });
}

describe("ExerciseCard plate-load guide", () => {
  it("renders a readable chip for every plate needed on each side", () => {
    const guide = renderCard({
      type: "barbell",
      config: {
        targetWeight: 155,
        barWeight: 45,
        achievedWeight: 155,
        perSide: [{ plate: 25, count: 2 }, { plate: 5, count: 1 }],
      },
    });

    expect(within(guide).getByText("Load each side")).toBeInTheDocument();
    expect(within(guide).getByText("25 lb plate × 2")).toBeInTheDocument();
    expect(within(guide).getByText("5 lb plate × 1")).toBeInTheDocument();
  });

  it("uses one-end wording for a landmine and pin wording for a pulley", () => {
    const { rerender } = render(
      <ExerciseCard
        exercise={exercise}
        setNumber={1}
        weight={90}
        equipmentDisplay={{
          type: "barbell",
          config: {
            targetWeight: 90,
            barWeight: 45,
            achievedWeight: 90,
            perSide: [{ plate: 45, count: 1 }],
            isLandmine: true,
          },
        }}
      />,
    );
    expect(screen.getByText("Load one end")).toBeInTheDocument();

    rerender(
      <ExerciseCard
        exercise={{ ...exercise, equipmentType: "pulley" }}
        setNumber={1}
        weight={45}
        equipmentDisplay={{
          type: "pulley",
          config: {
            targetWeight: 45,
            barWeight: 0,
            achievedWeight: 45,
            perSide: [{ plate: 45, count: 1 }],
          },
        }}
      />,
    );
    expect(screen.getByText("Load on pin")).toBeInTheDocument();
  });

  it("shows bar-only guidance when no plates are needed", () => {
    const guide = renderCard({
      type: "barbell",
      config: {
        targetWeight: 45,
        barWeight: 45,
        achievedWeight: 45,
        perSide: [],
      },
    });

    expect(within(guide).getByText("No plates — use the 45 lb bar")).toBeInTheDocument();
  });
});

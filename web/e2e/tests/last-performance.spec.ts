import { expect, test } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

test("shows the last session's weight and reps on the active set card", async ({ page }) => {
  await page.addInitScript((workout) => {
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout,
      resolvedWeights: { "exercise-1": 90 },
      previousPerformances: {
        "exercise-1": { weight: 85, reps: 10 },
      },
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      completedSets: [],
      isResting: false,
      restTimeRemaining: 0,
      startTime: new Date().toISOString(),
      prsAchieved: [],
    }));
  }, landminePressWorkout);

  await page.goto("/");

  await expect(page.getByText("Last time: 85 lb × 10")).toBeVisible();
});

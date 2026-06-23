// e2e/tests/optional-timer.spec.ts
// Verifies that the exercise timer is optional — timed exercises must show
// "Complete Set" so the user can mark the set done without starting the timer.

import { test, expect } from "@playwright/test";
import { pullUpWorkout } from "../fixtures/workout-fixtures";

test.describe("Exercise timer is optional", () => {
  test.beforeEach(async ({ page }) => {
    // pullUpWorkout starts with scapularHangs (isTimeBased: true)
    await page.addInitScript((workout) => {
      const session = {
        workout,
        resolvedWeights: { "exercise-1": 0, "exercise-2": 0, "exercise-3": 0 },
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        completedSets: [],
        isResting: false,
        restTimeRemaining: 0,
        startTime: new Date().toISOString(),
        prsAchieved: [],
      };
      localStorage.setItem("activeWorkout", JSON.stringify(session));
    }, pullUpWorkout);

    await page.goto("/");
  });

  test("shows Complete Set button for timed exercise without starting timer", async ({ page }) => {
    await expect(page.getByText("Scapular Hangs")).toBeVisible();
    await expect(page.getByRole("button", { name: /complete set/i })).toBeVisible();
  });

  test("can complete a timed set without starting the timer", async ({ page }) => {
    await page.getByRole("button", { name: /complete set/i }).click();

    // Set completion modal should open
    await expect(page.getByRole("button", { name: /save/i })).toBeVisible();
  });

  test("Start Timer button still present for timed exercises", async ({ page }) => {
    await expect(page.getByRole("button", { name: /start timer/i })).toBeVisible();
  });
});

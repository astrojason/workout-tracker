// e2e/tests/powerblock-increment.spec.ts
// Verifies the +/- buttons in the weight editor snap PowerBlock weights to
// valid 2.5 lb increments and clamp to the PowerBlock's 5-50 lb range,
// instead of allowing off-grid or out-of-range values.

import { test, expect } from "@playwright/test";
import { powerblockCurlWorkout } from "../fixtures/workout-fixtures";

test.describe("PowerBlock weight editor increments", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((workout) => {
      const session = {
        workout,
        resolvedWeights: { "exercise-1": 5 },
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        completedSets: [],
        isResting: false,
        restTimeRemaining: 0,
        startTime: new Date().toISOString(),
        prsAchieved: [],
      };
      localStorage.setItem("activeWorkout", JSON.stringify(session));
    }, powerblockCurlWorkout);

    await page.goto("/");
  });

  test("minus button does not go below the PowerBlock minimum (5 lbs)", async ({ page }) => {
    await page.getByRole("button", { name: /edit weight|change weight/i }).click();

    const weightInput = page.getByLabel(/weight/i);
    await expect(weightInput).toHaveValue("5");

    // Weight starts at the PowerBlock minimum (5 lbs) — pressing "-" must not
    // drop below that floor, since a real PowerBlock can't go lower.
    await page.getByRole("button", { name: "-", exact: true }).click();
    await expect(weightInput).toHaveValue("5");
  });

  test("plus button does not exceed the PowerBlock maximum (50 lbs)", async ({ page }) => {
    await page.addInitScript((workout) => {
      const session = {
        workout,
        resolvedWeights: { "exercise-1": 50 },
        currentExerciseIndex: 0,
        currentSetNumber: 1,
        completedSets: [],
        isResting: false,
        restTimeRemaining: 0,
        startTime: new Date().toISOString(),
        prsAchieved: [],
      };
      localStorage.setItem("activeWorkout", JSON.stringify(session));
    }, powerblockCurlWorkout);
    await page.goto("/");

    await page.getByRole("button", { name: /edit weight|change weight/i }).click();

    const weightInput = page.getByLabel(/weight/i);
    await expect(weightInput).toHaveValue("50");

    // Weight starts at the PowerBlock maximum (50 lbs) — pressing "+" must not
    // exceed that ceiling, since a real PowerBlock tops out at 50 lbs.
    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(weightInput).toHaveValue("50");
  });

  test("plus/minus step in exact 2.5 lb increments", async ({ page }) => {
    await page.getByRole("button", { name: /edit weight|change weight/i }).click();

    const weightInput = page.getByLabel(/weight/i);
    await expect(weightInput).toHaveValue("5");

    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(weightInput).toHaveValue("7.5");

    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(weightInput).toHaveValue("10");

    await page.getByRole("button", { name: "-", exact: true }).click();
    await expect(weightInput).toHaveValue("7.5");
  });
});

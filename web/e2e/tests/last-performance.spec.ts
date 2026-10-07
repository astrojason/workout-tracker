import { expect, test } from "@playwright/test";
import { landminePressWorkout, pullUpWorkout } from "../fixtures/workout-fixtures";

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

test.describe("assisted exercises show band count in last time", () => {
  async function seed(page: import("@playwright/test").Page, exerciseIndex: number, previous: { weight: number; reps: number }) {
    await page.addInitScript(({ workout, previous, exerciseIndex }) => {
      localStorage.setItem("activeWorkout", JSON.stringify({
        workout,
        resolvedWeights: { "exercise-1": 2, "exercise-2": 2 },
        previousPerformances: { [`exercise-${exerciseIndex + 1}`]: previous },
        currentExerciseIndex: exerciseIndex,
        currentSetNumber: 1,
        completedSets: [],
        isResting: false,
        restTimeRemaining: 0,
        startTime: new Date().toISOString(),
        prsAchieved: [],
      }));
    }, { workout: pullUpWorkout, previous, exerciseIndex });
    await page.goto("/");
  }

  test("time-based scapular hangs show bands, not just the duration", async ({ page }) => {
    await seed(page, 0, { weight: 2, reps: 30 });
    await expect(page.getByText(/Last time: 2 bands/)).toBeVisible();
  });

  test("assisted pull-ups show bands instead of lb", async ({ page }) => {
    await seed(page, 1, { weight: 2, reps: 4 });
    await expect(page.getByText("Last time: 2 bands × 4")).toBeVisible();
  });
});

test("assisted pull-ups ask for bands even with no starting weight, and carry it to the next set", async ({ page }) => {
  await page.addInitScript((workout) => {
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout,
      resolvedWeights: { "exercise-1": 0, "exercise-2": 0, "exercise-3": 0 },
      currentExerciseIndex: 1, // Assisted Pull-ups, weight 0
      currentSetNumber: 1,
      completedSets: [],
      isResting: false,
      restTimeRemaining: 0,
      startTime: new Date().toISOString(),
      prsAchieved: [],
    }));
  }, pullUpWorkout);
  await page.goto("/");

  await page.getByRole("button", { name: /complete set/i }).click();
  await page.getByLabel("Bands").fill("2");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: /skip rest/i }).click();

  await expect(page.getByText(/2 bands \(~160 lbs assistance\)/)).toBeVisible();
});

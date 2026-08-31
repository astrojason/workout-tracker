import { expect, test } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

function activeSession(workout: typeof landminePressWorkout, weight: number) {
  return {
    workout,
    resolvedWeights: { "exercise-1": weight },
    currentExerciseIndex: 0,
    currentSetNumber: 1,
    completedSets: [],
    isResting: false,
    restTimeRemaining: 0,
    startTime: new Date().toISOString(),
    prsAchieved: [],
  };
}

test.describe("live plate-load guide", () => {
  test("shows and updates the plates for a one-ended landmine", async ({ page }) => {
    await page.addInitScript((session) => {
      localStorage.setItem("activeWorkout", JSON.stringify(session));
    }, activeSession(landminePressWorkout, 90));

    await page.goto("/");

    const guide = page.getByRole("group", { name: "Plate loading instructions" });
    await expect(guide.getByText("Load one end")).toBeVisible();
    await expect(guide.getByText("45 lb plate × 1")).toBeVisible();

    await page.getByRole("button", { name: /edit weight/i }).click();
    await page.getByLabel("Weight (lbs)").fill("55");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(guide.getByText("10 lb plate × 1")).toBeVisible();
    await expect(guide.getByText("45 lb plate × 1")).not.toBeVisible();
  });

  test("shows the plates required on each side of a standard barbell", async ({ page }) => {
    const benchWorkout = {
      ...landminePressWorkout,
      exercises: landminePressWorkout.exercises.map((exercise) => ({
        ...exercise,
        name: "Bench Press",
        currentWeight: 155,
      })),
    };
    await page.addInitScript((session) => {
      localStorage.setItem("activeWorkout", JSON.stringify(session));
    }, activeSession(benchWorkout, 155));

    await page.goto("/");

    const guide = page.getByRole("group", { name: "Plate loading instructions" });
    await expect(guide.getByText("Load each side")).toBeVisible();
    await expect(guide.getByText("45 lb plate × 1")).toBeVisible();
    await expect(guide.getByText("10 lb plate × 1")).toBeVisible();
  });
});

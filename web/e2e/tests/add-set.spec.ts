// e2e/tests/add-set.spec.ts
// Verifies a custom set can be added mid-exercise: it's done at the current position and the
// planned set it replaced moves to the next set number, keeping its own weight.

import { test, expect } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

test.describe("Add a custom set mid-exercise", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript((workout) => {
            const session = {
                workout,
                resolvedWeights: { [workout.exercises[0].id]: 90 },
                currentExerciseIndex: 0,
                currentSetNumber: 1,
                completedSets: [],
                isResting: false,
                restTimeRemaining: 0,
                startTime: new Date().toISOString(),
                prsAchieved: [],
            };
            localStorage.setItem("activeWorkout", JSON.stringify(session));
        }, landminePressWorkout);

        await page.goto("/");
    });

    test("inserts the custom set before the current set and pushes the planned set back", async ({ page }) => {
        await expect(page.getByText("Set 1 of 3")).toBeVisible();

        await page.getByRole("button", { name: "+ Add Set" }).click();
        await page.getByLabel("Reps").fill("5");
        await page.getByLabel("Weight").fill("70");
        await page.getByRole("button", { name: "Add Set", exact: true }).click();

        await expect(page.getByText("Set 1 of 4")).toBeVisible();
        await expect(page.getByText("Custom set")).toBeVisible();
        await expect(page.getByText("(70 lbs)")).toBeVisible();

        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByRole("button", { name: /save/i }).click();
        await page.getByRole("button", { name: /skip rest/i }).click();

        // The planned set it pushed back is now set 2, at the plan's weight.
        await expect(page.getByText("Set 2 of 4")).toBeVisible();
        await expect(page.getByText("Custom set")).not.toBeVisible();
        await expect(page.getByText("(90 lbs)")).toBeVisible();
    });

    test("Remove takes the custom set back out without logging it", async ({ page }) => {
        await page.getByRole("button", { name: "+ Add Set" }).click();
        await page.getByRole("button", { name: "Add Set", exact: true }).click();
        await expect(page.getByText("Set 1 of 4")).toBeVisible();

        await page.getByRole("button", { name: "Remove" }).click();
        await expect(page.getByText("Set 1 of 3")).toBeVisible();
        await expect(page.getByText("Custom set")).not.toBeVisible();
    });
});

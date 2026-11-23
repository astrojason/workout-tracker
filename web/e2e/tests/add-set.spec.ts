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

test.describe("Do another set after an exercise is finished", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript((workout) => {
            const bench = { ...workout.exercises[0], sets: 1, restAfter: 90 };
            const row = { ...workout.exercises[0], id: "exercise-2", definitionId: "row", name: "Row", order: 2, equipmentType: "dumbbell", lastSetAmrap: false, repMin: 12, repMax: { type: "count", value: 12 } };
            const session = {
                workout: { ...workout, exercises: [bench, row] },
                resolvedWeights: { "exercise-1": 90, "exercise-2": 40 },
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

    test("the rest screen shows the next set's reps, and offers one more set of the exercise just finished", async ({ page }) => {
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("8");
        await page.getByRole("button", { name: /save/i }).click();

        // Resting before Row: the preview shows its reps.
        await expect(page.getByText("Up Next")).toBeVisible();
        await expect(page.getByText("Row - Set 1 of 3")).toBeVisible();
        await expect(page.locator("p", { hasText: "12 reps" })).toBeVisible();

        await page.getByRole("button", { name: "+ Another set of Landmine Press" }).click();
        await expect(page.getByLabel("Reps")).toHaveValue("8"); // from the set just logged
        await page.getByLabel("Reps").fill("6");
        await page.getByLabel("Weight").fill("100");
        await page.getByRole("button", { name: "Add Set", exact: true }).click();

        // Still resting, now ahead of the extra set.
        await expect(page.getByText("Landmine Press - Set 2 of 2")).toBeVisible();
        await expect(page.locator("p", { hasText: "6 reps" })).toBeVisible();
        await page.getByRole("button", { name: /skip rest/i }).click();

        await expect(page.getByText("Custom set")).toBeVisible();
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByRole("button", { name: /save/i }).click();
        await page.getByRole("button", { name: /skip rest/i }).click();

        await expect(page.getByRole("heading", { name: "Row" })).toBeVisible();
        await expect(page.getByText("Set 1 of 3")).toBeVisible();
    });
});

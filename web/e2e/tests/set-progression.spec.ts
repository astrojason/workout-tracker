// e2e/tests/set-progression.spec.ts
// Verifies that sets advance correctly through rest timers with no skips.
// Covers the double-advance bug fixed in useWorkout.ts.

import { test, expect } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

test.describe("Set progression with rest timer", () => {
    test.beforeEach(async ({ page }) => {
        // Inject workout state directly into localStorage before the app loads
        await page.addInitScript((workout) => {
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 90 },
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

    test("shows Set 1 of 3 at 90 lbs on load", async ({ page }) => {
        await expect(page.getByText("Set 1 of 3")).toBeVisible();
        await expect(page.getByText("90")).toBeVisible();
        await expect(page.getByText("8–10")).toBeVisible();
    });

    test("starts rest timer after completing Set 1", async ({ page }) => {
        await page.getByRole("button", { name: /complete set/i }).click();

        // Fill completion modal
        await page.getByLabel(/reps/i).fill("9");
        await page.getByLabel(/weight/i).fill("90");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();

        // Rest timer should be visible
        await expect(page.getByText(/rest/i)).toBeVisible();
        await expect(page.getByText(/2:00|1:5\d/)).toBeVisible();
    });

    test("shows Set 2 of 3 after rest timer completes — not Set 3", async ({ page }) => {
        // Complete Set 1
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("9");
        await page.getByLabel(/weight/i).fill("90");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();

        // Skip rest timer
        await page.getByRole("button", { name: /skip rest/i }).click();

        // Must be Set 2, not Set 3
        await expect(page.getByText("Set 2 of 3")).toBeVisible();
        await expect(page.getByText("Set 3 of 3")).not.toBeVisible();
    });

    test("shows AMRAP on Set 3 after completing Set 2", async ({ page }) => {
        // Complete Set 1
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("9");
        await page.getByLabel(/weight/i).fill("90");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();
        await page.getByRole("button", { name: /skip rest/i }).click();

        // Complete Set 2
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("8");
        await page.getByLabel(/weight/i).fill("90");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();
        await page.getByRole("button", { name: /skip rest/i }).click();

        // Set 3 must show AMRAP
        await expect(page.getByText("Set 3 of 3")).toBeVisible();
        await expect(page.getByText(/amrap/i)).toBeVisible();
        await expect(page.getByText("8–10")).not.toBeVisible();
    });

    test("advancing past Set 3 ends the workout, not skipping to next exercise", async ({ page }) => {
        const completeSet = async (reps: string) => {
            await page.getByRole("button", { name: /complete set/i }).click();
            await page.getByLabel(/reps/i).fill(reps);
            await page.getByLabel(/weight/i).fill("90");
            await page.getByRole("button", { name: /normal/i }).click();
            await page.getByRole("button", { name: /save/i }).click();
            const skipBtn = page.getByRole("button", { name: /skip rest/i });
            if (await skipBtn.isVisible()) await skipBtn.click();
        };

        await completeSet("9");
        await completeSet("8");
        await completeSet("12"); // AMRAP set

        // Workout complete screen should appear
        await expect(page.getByText(/workout complete/i)).toBeVisible();
    });
});
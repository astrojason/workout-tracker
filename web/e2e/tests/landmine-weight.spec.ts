// e2e/tests/landmine-weight.spec.ts
// Verifies landmine press uses single-side plate loading,
// not bilateral (split per side) loading.

import { test, expect } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

test.describe("Landmine Press weight display", () => {
    test.beforeEach(async ({ page }) => {
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

    test("displays 90 lbs total", async ({ page }) => {
        await expect(page.getByText("90")).toBeVisible();
    });

    test("shows 45 lb bar + 45 lb plate (one side) — not 45 lb bar + 22.5/side", async ({ page }) => {
        // Single-side: 45 bar + 45 plate = 90 total
        await expect(page.getByText(/45.*bar|bar.*45/i)).toBeVisible();
        await expect(page.getByText(/45.*plate|one side/i)).toBeVisible();

        // Must NOT show bilateral split
        await expect(page.getByText(/22\.5.*side|per side.*22/i)).not.toBeVisible();
    });

    test("shows 55 lb landmine as 45 bar + 10 plate, not 45 bar + 5/side", async ({ page }) => {
        // Override to 55 lb session
        await page.addInitScript((workout) => {
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 55 },
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

        await expect(page.getByText(/10.*plate|one side/i)).toBeVisible();
        await expect(page.getByText(/5.*side|per side.*5/i)).not.toBeVisible();
    });
});
// e2e/tests/meadows-row-weight.spec.ts
// Verifies Meadows Row uses single-side (landmine-style) plate loading,
// not bilateral (split per side) loading — even though its name doesn't
// contain the word "landmine".

import { test, expect } from "@playwright/test";
import { meadowsRowWorkout } from "../fixtures/workout-fixtures";

test.describe("Meadows Row weight display", () => {
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
        }, meadowsRowWorkout);

        await page.goto("/");
    });

    test("displays 90 lbs total", async ({ page }) => {
        await expect(page.getByText("90")).toBeVisible();
    });

    test("shows 45 lb bar + [1x45] one end — not 45 lb bar + 22.5/side", async ({ page }) => {
        // Single-side: 45 bar + 45 plate = 90 total
        await expect(page.getByText(/45lb bar/i)).toBeVisible();
        await expect(page.getByText(/1x45.*one end/i)).toBeVisible();

        // Must NOT show bilateral split
        await expect(page.getByText(/22\.5.*side|per side.*22/i)).not.toBeVisible();
    });
});

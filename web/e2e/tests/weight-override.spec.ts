// e2e/tests/weight-override.spec.ts
// Verifies mid-workout weight changes apply only to future sets
// and do not retroactively change completed set records.

import { test, expect } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

test.describe("Mid-workout weight override", () => {
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

    test("weight editor updates display immediately", async ({ page }) => {
        await expect(page.getByText("90")).toBeVisible();

        await page.getByRole("button", { name: /edit weight|change weight/i }).click();
        await page.getByLabel(/weight/i).fill("85");
        await page.getByRole("button", { name: /save|confirm/i }).click();

        await expect(page.getByText("85")).toBeVisible();
        await expect(page.getByText("90")).not.toBeVisible();
    });

    test("completed sets retain original target weight after weight change", async ({ page }) => {
        // Complete Set 1 at 90 lbs
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("9");
        await page.getByLabel(/weight/i).fill("90");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();
        await page.getByRole("button", { name: /skip rest/i }).click();

        // Now on Set 2 — change weight to 85
        await page.getByRole("button", { name: /edit weight|change weight/i }).click();
        await page.getByLabel(/weight/i).fill("85");
        await page.getByRole("button", { name: /save|confirm/i }).click();

        // Complete Set 2 at 85
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("8");
        await page.getByLabel(/weight/i).fill("85");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();
        await page.getByRole("button", { name: /skip rest/i }).click();

        // Complete final AMRAP set
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("11");
        await page.getByLabel(/weight/i).fill("85");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();

        // Workout complete — check session detail
        await expect(page.getByText(/workout complete/i)).toBeVisible();
        await page.getByRole("link", { name: /view session|details/i }).click();

        // Set 1 should show targetWeight 90, Set 2 and 3 should show 85
        const rows = page.getByRole("row");
        await expect(rows.nth(1)).toContainText("90"); // Set 1 target
        await expect(rows.nth(2)).toContainText("85"); // Set 2 target
        await expect(rows.nth(3)).toContainText("85"); // Set 3 target
    });

    test("weight change does not affect other exercises", async ({ page }) => {
        // This test requires a multi-exercise workout
        // Using warmupWorkout fixture which has 2 exercises
        await page.addInitScript(() => {
            // Clear and inject a 2-exercise session
            const workout = {
                id: "test_1_tuesday",
                programName: "Test",
                week: 1,
                dayOfWeek: "Tuesday",
                exercises: [
                    {
                        id: "exercise-1",
                        definitionId: "def-landmine-press",
                        order: 1,
                        name: "Landmine Press",
                        phase: "main",
                        equipmentType: "barbell_45",
                        equipmentDetail: null,
                        muscleGroups: [],
                        currentWeight: 90,
                        hardStreak: 0,
                        sets: 1,
                        repMin: 8,
                        repMax: { type: "count", value: 10 },
                        restSeconds: 0,
                        progressionRule: "add_5lb",
                        isUnilateral: false,
                        isTimeBased: false,
                        notes: null,
                    },
                    {
                        id: "exercise-2",
                        definitionId: "def-barbell-row",
                        order: 2,
                        name: "Barbell Row",
                        phase: "main",
                        equipmentType: "barbell_45",
                        equipmentDetail: null,
                        muscleGroups: [],
                        currentWeight: 135,
                        hardStreak: 0,
                        sets: 1,
                        repMin: 8,
                        repMax: { type: "count", value: 10 },
                        restSeconds: 0,
                        progressionRule: "add_10lb",
                        isUnilateral: false,
                        isTimeBased: false,
                        notes: null,
                    },
                ],
                isChecklist: false,
            };
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 90, "exercise-2": 135 },
                currentExerciseIndex: 0,
                currentSetNumber: 1,
                completedSets: [],
                isResting: false,
                restTimeRemaining: 0,
                startTime: new Date().toISOString(),
                prsAchieved: [],
            };
            localStorage.setItem("activeWorkout", JSON.stringify(session));
        });

        await page.goto("/");

        // Change weight for Exercise 1
        await page.getByRole("button", { name: /edit weight|change weight/i }).click();
        await page.getByLabel(/weight/i).fill("85");
        await page.getByRole("button", { name: /save|confirm/i }).click();

        // Complete Exercise 1
        await page.getByRole("button", { name: /complete set/i }).click();
        await page.getByLabel(/reps/i).fill("9");
        await page.getByLabel(/weight/i).fill("85");
        await page.getByRole("button", { name: /normal/i }).click();
        await page.getByRole("button", { name: /save/i }).click();

        // Exercise 2 should still show 135, not 85
        await expect(page.getByText("135")).toBeVisible();
        await expect(page.getByText("85")).not.toBeVisible();
    });
});
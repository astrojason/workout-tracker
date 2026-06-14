// e2e/tests/crash-recovery.spec.ts
// Verifies localStorage session restore lands on the correct set
// with no skips, including mid-rest crash recovery.

import { test, expect, type Page } from "@playwright/test";
import { landminePressWorkout } from "../fixtures/workout-fixtures";

// Injects a mid-workout session into localStorage as if the app crashed
// after completing Set 1 and starting the rest timer.
const injectMidRestSession = async (
    page: Page,
    setNumber: number,
    isResting: boolean,
    restSecondsRemaining?: number
) => {
    await page.addInitScript(
        ({ workout, setNumber, isResting, restEnd }) => {
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 90 },
                currentExerciseIndex: 0,
                currentSetNumber: setNumber,
                completedSets: [],
                isResting,
                restTimeRemaining: 0,
                startTime: new Date().toISOString(),
                prsAchieved: [],
            };
            localStorage.setItem("activeWorkout", JSON.stringify(session));
            if (restEnd) {
                localStorage.setItem("activeWorkoutRestEnd", restEnd);
            }
        },
        {
            workout: landminePressWorkout,
            setNumber,
            isResting,
            restEnd: restSecondsRemaining
                ? new Date(Date.now() + restSecondsRemaining * 1000).toISOString()
                : null,
        }
    );
};

test.describe("Crash recovery", () => {
    test("restores to Set 2 when app crashed mid-rest after Set 1", async ({ page }) => {
        // Session was saved after Set 1 completed, rest timer running with 60s left
        await injectMidRestSession(page, 2, true, 60);
        await page.goto("/");

        // Should resume the rest timer, not be on Set 1
        await expect(page.getByText(/rest/i)).toBeVisible();

        // Skip rest — should land on Set 2, not Set 1 or Set 3
        await page.getByRole("button", { name: /skip rest/i }).click();
        await expect(page.getByText("Set 2 of 3")).toBeVisible();
    });

    test("lands on correct set when rest timer expired while app was closed", async ({ page }) => {
        // Session saved with isResting: true but restEnd in the past
        await page.addInitScript((workout) => {
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 90 },
                currentExerciseIndex: 0,
                currentSetNumber: 2, // already advanced before timer started
                completedSets: [],
                isResting: true,
                restTimeRemaining: 0,
                startTime: new Date().toISOString(),
                prsAchieved: [],
            };
            localStorage.setItem("activeWorkout", JSON.stringify(session));
            // Rest end is in the past — timer already expired
            localStorage.setItem(
                "activeWorkoutRestEnd",
                new Date(Date.now() - 5000).toISOString()
            );
        }, landminePressWorkout);

        await page.goto("/");

        // Should show Set 2, not Set 1 or Set 3
        await expect(page.getByText("Set 2 of 3")).toBeVisible();
        await expect(page.getByText(/rest/i)).not.toBeVisible();
    });

    test("shows resume banner when workout was paused", async ({ page }) => {
        await page.addInitScript((workout) => {
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 90 },
                currentExerciseIndex: 0,
                currentSetNumber: 2,
                completedSets: [],
                isResting: false,
                restTimeRemaining: 0,
                startTime: new Date().toISOString(),
                prsAchieved: [],
            };
            localStorage.setItem("activeWorkout", JSON.stringify(session));
            localStorage.setItem("workoutPaused", "1");
        }, landminePressWorkout);

        await page.goto("/");

        // Resume banner should be visible, not the active workout
        await expect(page.getByText(/resume/i)).toBeVisible();
        await expect(page.getByText("Set 2 of 3")).not.toBeVisible();
    });

    test("resumes from correct set after pause", async ({ page }) => {
        await page.addInitScript((workout) => {
            const session = {
                workout,
                resolvedWeights: { "exercise-1": 90 },
                currentExerciseIndex: 0,
                currentSetNumber: 2,
                completedSets: [],
                isResting: false,
                restTimeRemaining: 0,
                startTime: new Date().toISOString(),
                prsAchieved: [],
            };
            localStorage.setItem("activeWorkout", JSON.stringify(session));
            localStorage.setItem("workoutPaused", "1");
        }, landminePressWorkout);

        await page.goto("/");
        await page.getByRole("button", { name: /resume/i }).click();

        await expect(page.getByText("Set 2 of 3")).toBeVisible();
    });
});
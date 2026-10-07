// Verifies the idle action buttons on a timed exercise stack on mobile:
// Start Timer on its own row, then Skip | Complete Set beneath it.
import { expect, test } from "@playwright/test";
import { pullUpWorkout } from "../fixtures/workout-fixtures";

async function seedTimedExercise(page: import("@playwright/test").Page) {
  await page.addInitScript((workout) => {
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout,
      resolvedWeights: { "exercise-1": 2 },
      currentExerciseIndex: 0, // Scapular Hangs — time-based
      currentSetNumber: 1,
      completedSets: [],
      isResting: false,
      restTimeRemaining: 0,
      startTime: new Date().toISOString(),
      prsAchieved: [],
    }));
  }, pullUpWorkout);
  await page.goto("/");
}

async function boxes(page: import("@playwright/test").Page) {
  const start = await page.getByRole("button", { name: "Start Timer" }).boundingBox();
  const skip = await page.getByRole("button", { name: "Skip", exact: true }).boundingBox();
  const complete = await page.getByRole("button", { name: "Complete Set" }).boundingBox();
  if (!start || !skip || !complete) throw new Error("Expected all three action buttons to be visible");
  return { start, skip, complete };
}

test.describe("timed exercise action buttons", () => {
  test("mobile: Start Timer on top, Skip and Complete Set side by side below", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedTimedExercise(page);

    const { start, skip, complete } = await boxes(page);

    expect(start.y + start.height).toBeLessThanOrEqual(skip.y);
    expect(Math.abs(skip.y - complete.y)).toBeLessThan(2);
    expect(skip.x).toBeLessThan(complete.x);
    expect(start.width).toBeGreaterThan(skip.width + complete.width);
  });

  test("desktop: all three stay in one row", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await seedTimedExercise(page);

    const { start, skip, complete } = await boxes(page);

    expect(Math.abs(start.y - skip.y)).toBeLessThan(2);
    expect(Math.abs(complete.y - skip.y)).toBeLessThan(2);
  });
});

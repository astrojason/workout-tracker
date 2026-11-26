// A timed exercise held to failure ("Max hold", e.g. Scapular Hangs from an imported program) is a
// hold, not a rep count: its work sets must say "Max hold", never AMRAP.
import { expect, test } from "@playwright/test";
import { pullUpWorkout, scapularHangs } from "../fixtures/workout-fixtures";

const maxHoldWorkout = {
  ...pullUpWorkout,
  exercises: [{ ...scapularHangs, id: "exercise-1", order: 1, repMax: { type: "failure" as const } }],
};

test("a max-hold timed set says Max hold, not AMRAP", async ({ page }) => {
  await page.addInitScript((workout) => {
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout,
      resolvedWeights: { "exercise-1": 0 },
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      completedSets: [],
      isResting: false,
      restTimeRemaining: 0,
      startTime: new Date().toISOString(),
      prsAchieved: [],
    }));
  }, maxHoldWorkout);
  await page.goto("/");

  await expect(page.getByText("Scapular Hangs").first()).toBeVisible();
  await expect(page.getByText("Max hold").first()).toBeVisible();
  await expect(page.getByText("AMRAP")).toHaveCount(0);

  await page.getByRole("button", { name: "Complete Set" }).click();
  await expect(page.getByText(/Max holds count as Hard/)).toBeVisible();
  await expect(page.getByText("AMRAP")).toHaveCount(0);
});

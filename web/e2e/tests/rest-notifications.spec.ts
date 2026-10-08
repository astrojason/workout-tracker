import { test, expect } from "@playwright/test";
import { pullUpWorkout } from "../fixtures/workout-fixtures";

// Full Chromium supports notifications; the default headless shell does not.
test.use({ channel: "chromium" });

test("opt in during rest and deliver a notification through the real service worker", async ({ page, context }) => {
  await context.grantPermissions(["notifications"], { origin: "http://localhost:3000" });
  await page.addInitScript((workout) => {
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout,
      resolvedWeights: {},
      currentExerciseIndex: 0,
      currentSetNumber: 2,
      completedSets: [],
      isResting: true,
      restTimeRemaining: 60,
      startTime: new Date().toISOString(),
      prsAchieved: [],
    }));
    localStorage.setItem("activeWorkoutRestEnd", new Date(Date.now() + 60000).toISOString());
  }, pullUpWorkout);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Enable rest notifications" }).click();
  await expect(page.getByRole("button", { name: "Turn off rest notifications" })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page.getByRole("button", { name: "Skip Rest" })).not.toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag: "workout-rest-complete" });
    return notifications.map((notification) => notification.title);
  })).toEqual(["Rest complete"]);
});

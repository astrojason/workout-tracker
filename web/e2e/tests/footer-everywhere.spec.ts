// The bottom nav (with the version link) is part of the app shell, so it appears once on every view.
import { expect, test } from "@playwright/test";
import { pullUpWorkout } from "../fixtures/workout-fixtures";

const routes = [
  "/", "/history", "/settings", "/settings/equipment", "/settings/exercises",
  "/changelog", "/session/example", "/exercise/Bench%20Press", "/programs/example",
];

for (const route of routes) {
  test(`shows the footer once on ${route}`, async ({ page }) => {
    await page.goto(route);
    const nav = page.getByRole("navigation");
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link", { name: /^v\d/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /home/i })).toBeVisible();
  });
}

test("shows the footer during an active workout", async ({ page }) => {
  await page.addInitScript((workout) => {
    localStorage.setItem("activeWorkout", JSON.stringify({
      workout, resolvedWeights: {}, currentExerciseIndex: 0, currentSetNumber: 1, completedSets: [],
      isResting: false, restTimeRemaining: 0, startTime: new Date().toISOString(), prsAchieved: [],
    }));
  }, pullUpWorkout);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /end workout/i })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(1);
});

test("highlights the tab for the current section", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByRole("navigation").getByRole("link", { name: /history/i })).toHaveClass(/text-indigo-400/);
  await page.goto("/settings/equipment");
  await expect(page.getByRole("navigation").getByRole("link", { name: /settings/i })).toHaveClass(/text-indigo-400/);
});

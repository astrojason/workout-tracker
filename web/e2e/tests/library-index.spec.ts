// Desktop Exercises page: your exercise library, each row leading to the exercise's report.
// (The Programs page is covered by programs-manager.spec.ts.)
import { expect, test } from "@playwright/test";

test.describe("programs and exercises", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/library-index");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const exercises = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Exercises" });



  test("lists the exercise library, linking each to its report", async ({ page }) => {
    await expect(exercises(page).locator("tbody tr")).toHaveCount(3);
    const squat = exercises(page).getByRole("row", { name: /Back Squat/ });
    await expect(squat.getByRole("link", { name: "Back Squat" })).toHaveAttribute("href", "/exercise/Back%20Squat");
    await expect(squat).toContainText("Barbell 45");
    await expect(squat).toContainText("Quads · Glutes");
    await expect(exercises(page).getByRole("row", { name: /Hammer Curl/ })).toContainText("Never");
    await expect(exercises(page).getByRole("link", { name: /Edit the library/ })).toHaveAttribute("href", "/settings/exercises");
  });

  test("filters exercises by search and equipment", async ({ page }) => {
    await exercises(page).getByLabel("Search exercises").fill("pull");
    await expect(exercises(page).locator("tbody tr")).toHaveCount(1);
    await exercises(page).getByLabel("Search exercises").fill("");
    await exercises(page).getByLabel("Equipment").selectOption("dumbbell");
    await expect(exercises(page).locator("tbody tr")).toHaveCount(1);
    await expect(exercises(page).getByRole("row", { name: /Hammer Curl/ })).toBeVisible();
  });
});

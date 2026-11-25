// Desktop Programs and Exercises pages: tables of your programs and your exercise library, each
// row leading to its editor or report.
import { expect, test } from "@playwright/test";

test.describe("programs and exercises", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/library-index");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const programs = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Programs" });
  const exercises = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Exercises" });

  test("lists active programs with their week, days and activity, linking to the editor", async ({ page }) => {
    const row = programs(page).getByRole("row", { name: /Block B/ });
    await expect(row.getByRole("link", { name: "Block B" })).toHaveAttribute("href", "/programs/p1");
    await expect(row).toContainText("Week 7 of 12");
    await expect(row).toContainText("Mon · Tue · Thu · Fri");
    await expect(row).toContainText("26");
    await expect(programs(page).getByRole("row", { name: /Block A/ })).toHaveCount(0);
    await expect(programs(page).getByRole("link", { name: /Import or manage programs/ })).toHaveAttribute("href", "/settings");
  });

  test("archived programs show when asked", async ({ page }) => {
    await programs(page).getByLabel("Show archived").check();
    await expect(programs(page).getByRole("row", { name: /Block A/ })).toContainText("Archived");
  });

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

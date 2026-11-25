// Desktop exercise page: a report for one exercise — headline numbers, strength trend, rep records,
// final-set ratings and the full set log. Phones keep the existing progress page.
import { expect, test } from "@playwright/test";

test.describe("exercise report", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/exercise-report");
    await page.locator("main[data-hydrated]").waitFor();
  });

  test("shows the exercise with its equipment, muscles and progression", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Back Squat" })).toBeVisible();
    await expect(page.getByText("Barbell 45", { exact: true })).toBeVisible();
    await expect(page.getByText("Quads · Glutes", { exact: true })).toBeVisible();
    await expect(page.getByText("Progression: add 5 lb", { exact: true })).toBeVisible();
  });

  test("headline numbers summarise the range", async ({ page }) => {
    const kpis = page.getByRole("region", { name: "Key numbers" });
    await expect(kpis.getByTestId("stat-working-load")).toContainText("230 lb");
    await expect(kpis.getByTestId("stat-heaviest")).toContainText("225 lb × 6");
    await expect(kpis.getByTestId("stat-e1rm")).toContainText("270 lb");
    await expect(kpis.getByTestId("stat-sessions")).toContainText("4");
  });

  test("the range picker narrows the report", async ({ page }) => {
    await page.getByRole("button", { name: "4 wk" }).click();
    await expect(page.getByTestId("stat-sessions")).toContainText("3");
    await expect(page.getByRole("region", { name: "Rep records" }).getByRole("row", { name: /^8 / })).toHaveCount(0);
  });

  test("draws the strength trend", async ({ page }) => {
    await expect(page.getByRole("img", { name: /Strength trend/ })).toBeVisible();
    await page.getByLabel("Metric").selectOption("volume");
    await expect(page.getByRole("img", { name: /Volume per session/ })).toBeVisible();
  });

  test("lists rep records and final-set ratings", async ({ page }) => {
    const records = page.getByRole("region", { name: "Rep records" });
    await expect(records.getByRole("row", { name: /^6 225 lb/ })).toBeVisible();
    await expect(records.getByRole("row", { name: /^8 205 lb/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "Final-set ratings: 1 easy, 1 normal, 2 hard" })).toBeVisible();
  });

  test("the set log hides warm-ups until asked and links to each session", async ({ page }) => {
    const log = page.getByRole("region", { name: "Set log" });
    await expect(log.locator("tbody tr")).toHaveCount(5);
    await log.getByLabel("Include warm-ups").check();
    await expect(log.locator("tbody tr")).toHaveCount(6);
    await expect(log.locator('a[href="/session/s1"]').first()).toBeVisible();
    await expect(log.getByText("Belt")).toBeVisible();
  });

  test("exports the set log as CSV", async ({ page }) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toBe("back-squat-sets.csv");
  });
});

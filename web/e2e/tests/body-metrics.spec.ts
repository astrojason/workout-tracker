import { expect, test } from "@playwright/test";

test("logs body weight and optional measurements and charts the trend", async ({ page }) => {
  await page.goto("/test-preview/body-metrics");

  await expect(page.getByRole("heading", { name: "Body metrics" })).toBeVisible();
  await page.getByRole("button", { name: "Log check-in" }).click();
  await page.getByLabel("Date").fill("2026-09-07");
  await page.getByLabel("Body weight (lbs)").fill("178.5");
  await page.getByLabel("Waist (in)").fill("33.25");
  await page.getByRole("button", { name: "Save check-in" }).click();

  await expect(page.getByText("178.5 lbs").first()).toBeVisible();
  await expect(page.getByText("33.25 in waist")).toBeVisible();
  await expect(page.getByLabel("Chart metric")).toContainText("Waist");
  await expect(page.getByRole("img", { name: "Body metrics trend chart" })).toBeVisible();
});

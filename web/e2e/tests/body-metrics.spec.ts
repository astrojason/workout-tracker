import { expect, test } from "@playwright/test";

test("logs body weight and optional measurements and charts the trend", async ({ page }) => {
  await page.goto("/test-preview/body-metrics");

  await expect(page.getByRole("heading", { name: "Body metrics" })).toBeVisible();
  await page.getByRole("button", { name: "Log check-in" }).click();
  await page.getByLabel("Date").fill("2026-09-07");
  await page.getByLabel("Body weight (lbs)").fill("178.5");
  await page.getByLabel("Waist (in)").fill("33.25");
  await page.getByLabel("Body fat (%)").fill("20.8");
  await page.getByLabel("Muscle mass (lbs)").fill("131.5");
  await page.getByLabel("Visceral fat rating").fill("7");
  await page.getByRole("button", { name: "Save check-in" }).click();

  await expect(page.getByText("178.5 lbs").first()).toBeVisible();
  await expect(page.getByText("33.25 in waist")).toBeVisible();
  await expect(page.getByText("20.8% body fat")).toBeVisible();
  await expect(page.getByText("131.5 lbs muscle mass")).toBeVisible();
  await expect(page.getByLabel("Chart metric")).toContainText("Waist");
  await expect(page.getByLabel("Chart metric")).toContainText("Body fat");
  await expect(page.getByRole("img", { name: "Body metrics trend chart" })).toBeVisible();
});

test("accepts eighth-inch decimals and whole numbers, without redundant arm/thigh", async ({ page }) => {
  await page.goto("/test-preview/body-metrics");
  await page.getByRole("button", { name: "Log check-in" }).click();

  await expect(page.getByLabel("Arm (in)", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Thigh (in)", { exact: true })).toHaveCount(0);

  await page.getByLabel("Body weight (lbs)").fill("178.5");
  await page.getByLabel("Right bicep (in)").fill("12.875");
  await page.getByLabel("BMR (kcal)").fill("1850");
  await page.getByLabel("Metabolic age (years)").fill("34");
  await page.getByRole("button", { name: "Save check-in" }).click();

  await expect(page.getByText("12.875 in right bicep")).toBeVisible();
  await expect(page.getByText("1850 kcal bmr")).toBeVisible();
  await expect(page.getByText("34 years metabolic age")).toBeVisible();
});

test("form inputs line up in each row of the grid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/test-preview/body-metrics");
  await page.getByRole("button", { name: "Log check-in" }).click();

  const labels = ["Subcutaneous fat (%)", "Protein (%)", "Visceral fat rating", "Muscle mass (lbs)", "Fat-free weight (lbs)", "Standard weight (lbs)"];
  const bottoms: Record<string, number> = {};
  for (const l of labels) {
    const box = await page.getByLabel(l, { exact: true }).boundingBox();
    bottoms[l] = box!.y;
  }
  // Same grid row (2 columns): inputs must share a top edge.
  expect(bottoms["Subcutaneous fat (%)"]).toBe(bottoms["Protein (%)"]);
  expect(bottoms["Fat-free weight (lbs)"]).toBe(bottoms["Standard weight (lbs)"]);
});

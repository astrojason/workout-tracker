import { expect, test } from "@playwright/test";

test("import asks about each unmatched exercise one at a time", async ({ page }) => {
  await page.goto("/test-preview/exercise-match");

  // First exercise: link to an existing library exercise (the closest match is suggested).
  await expect(page.getByText("Exercise 1 of 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hammer Curls" })).toBeVisible();
  await expect(page.getByLabel("Dumbbell Hammer Curl")).toBeChecked();
  await page.getByRole("button", { name: "Use selected exercise" }).click();

  // Second exercise: only after the first was answered. Search the library, then create instead.
  await expect(page.getByText("Exercise 2 of 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fitarc Circuit" })).toBeVisible();
  await page.getByLabel("Search library").fill("bench");
  await expect(page.getByLabel("Bench Press")).toBeVisible();
  await expect(page.getByLabel("Dumbbell Hammer Curl")).toHaveCount(0);
  await page.getByRole("button", { name: "Create new exercise" }).click();

  await expect(page.getByTestId("decisions")).toHaveText(
    "Hammer Curls → use d-hammer; Fitarc Circuit → create",
  );
});

test("'Use selected exercise' stays disabled until something is selected, and import can be cancelled", async ({ page }) => {
  await page.goto("/test-preview/exercise-match");
  await page.getByLabel("Search library").fill("zzz-no-match");
  await expect(page.getByText("No exercises match")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use selected exercise" })).toBeDisabled();

  await page.getByRole("button", { name: "Cancel import" }).click();
  await expect(page.getByTestId("decisions")).toHaveText("Hammer Curls → cancel");
});

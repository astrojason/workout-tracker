// Verifies a scheduled day can be explicitly marked "skipped" from the Home
// program card, instead of a missed session showing up as silence in history.
import { expect, test } from "@playwright/test";

test.describe("mark a scheduled day as skipped", () => {
  test("marks today's workout as skipped from the today button's skip link", async ({ page }) => {
    await page.goto("/test-preview/program-card");

    await expect(page.getByRole("button", { name: /^start/i })).toBeVisible();

    await page.getByRole("button", { name: /mark today as skipped/i }).click();

    const skippedButton = page.getByRole("button", { name: /today's workout skipped/i });
    await expect(skippedButton).toBeVisible();
    await expect(skippedButton).toBeDisabled();
    await expect(page.getByRole("button", { name: /mark today as skipped/i })).toHaveCount(0);
  });

  test("shows a Skip action in the day list and reflects it as Skipped once clicked", async ({ page }) => {
    await page.goto("/test-preview/program-card");

    await page.getByRole("button", { name: /choose different day/i }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();

    await expect(page.getByText("Skipped", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  });
});

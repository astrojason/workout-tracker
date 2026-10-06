// Verifies the AI coach panel: ask for feedback, review suggested adjustments,
// apply them one at a time, and surface request failures instead of swallowing them.
import { expect, test } from "@playwright/test";

test.describe("AI coach panel", () => {
  test("asks the coach, shows feedback and suggestions, and applies one", async ({ page }) => {
    await page.goto("/test-preview/coach");

    await page.getByRole("button", { name: /ask coach/i }).click();

    await expect(page.getByText("Strong session — squats moved fast.")).toBeVisible();
    await expect(page.getByText(/Squat/)).toBeVisible();
    await expect(page.getByText("135 → 145")).toBeVisible();
    await expect(page.getByText("Every set felt easy")).toBeVisible();

    await page.getByRole("button", { name: /apply squat weight/i }).click();

    await expect(page.getByText("Applied")).toBeVisible();
    await expect(page.getByRole("button", { name: /apply squat weight/i })).toHaveCount(0);
    await expect(page.getByTestId("applied-log")).toHaveText("Squat:weight:145");
  });

  test("shows the actual error in the error modal when the coach fails", async ({ page }) => {
    await page.goto("/test-preview/coach?fail=1");

    await page.getByRole("button", { name: /ask coach/i }).click();

    await expect(page.getByText("Anthropic API error 529: overloaded")).toBeVisible();
  });
});

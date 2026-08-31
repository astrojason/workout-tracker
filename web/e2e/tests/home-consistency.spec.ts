import { expect, test } from "@playwright/test";

test.describe("home workout consistency", () => {
  test("shows the current streak and weekly planned-session progress", async ({ page }) => {
    // The production Home screen is behind Google OAuth. This development-only
    // route renders the exact Home component with deterministic values so its
    // browser behavior remains testable without production credentials.
    await page.goto("/test-preview/consistency");

    await expect(page.getByRole("heading", { name: "Workout consistency" })).toBeVisible();
    await expect(page.getByText("3 day streak")).toBeVisible();
    await expect(page.getByText("This week: 3/4 planned sessions")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Weekly workout progress" })).toBeVisible();
  });
});

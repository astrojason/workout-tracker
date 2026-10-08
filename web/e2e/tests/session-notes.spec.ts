// Verifies that per-set notes entered during a workout are shown in the session history detail.
import { expect, test } from "@playwright/test";

test.describe("Session history notes", () => {
  test("shows the note recorded for a set", async ({ page }) => {
    await page.goto("/test-preview/session-notes");

    await expect(page.getByText("Left knee felt tight on set 2")).toBeVisible();
  });

  test("does not render a note row for sets without notes", async ({ page }) => {
    await page.goto("/test-preview/session-notes");

    await expect(page.getByTestId("set-note")).toHaveCount(1);
  });
});

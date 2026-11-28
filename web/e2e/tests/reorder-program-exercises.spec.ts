// Program editor: exercises in a day can be moved up and down one place at a time.
import { expect, test } from "@playwright/test";

test.describe("reorder program exercises", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test-preview/program-day");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const names = (page: import("@playwright/test").Page) =>
    page.getByRole("list", { name: "Monday exercises" }).getByRole("listitem").locator("[data-exercise-name]");

  test("moving an exercise up shows progress, then the new order", async ({ page }) => {
    await expect(names(page)).toHaveText(["Back Squat", "Bench Press", "Barbell Row"]);
    await page.getByRole("button", { name: "Move Barbell Row up" }).click();
    await expect(page.getByRole("button", { name: "Moving Barbell Row…" })).toBeDisabled();
    await expect(names(page)).toHaveText(["Back Squat", "Barbell Row", "Bench Press"]);
    await expect(page.getByText("Saved order")).toBeVisible();
  });

  test("moving an exercise down", async ({ page }) => {
    await page.getByRole("button", { name: "Move Back Squat down" }).click();
    await expect(names(page)).toHaveText(["Bench Press", "Back Squat", "Barbell Row"]);
  });

  test("the first can't move up and the last can't move down", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Move Back Squat up" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Move Barbell Row down" })).toBeDisabled();
  });

  test("a failed save shows the error and keeps the old order", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Fail saves" }).check();
    await page.getByRole("button", { name: "Move Bench Press up" }).click();
    await expect(page.getByText("Preview: saving the order failed")).toBeVisible();
    await expect(names(page)).toHaveText(["Back Squat", "Bench Press", "Barbell Row"]);
  });
});

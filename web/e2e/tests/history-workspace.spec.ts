// Desktop History: the session list on the left, the selected session on the right with its
// logged sets editable in place. Every discard/remove/delete asks first.
import { expect, test } from "@playwright/test";

test.describe("history workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/history-workspace");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const list = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Sessions" }).getByRole("button");
  const detail = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Selected session" });

  test("lists sessions and shows the newest one", async ({ page }) => {
    await expect(list(page)).toHaveCount(3);
    await expect(detail(page)).toContainText("Monday · Week 7");
    await expect(detail(page).getByLabel("Weight, Back Squat set 1")).toHaveValue("225");
    await expect(detail(page)).toContainText("220 → 225 lb");
  });

  test("filters by status and by search", async ({ page }) => {
    await page.getByRole("button", { name: "Skipped", exact: true }).click();
    await expect(list(page)).toHaveCount(1);
    await page.getByRole("button", { name: "Partial", exact: true }).click();
    await expect(list(page)).toHaveCount(1);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByLabel("Filter sessions").fill("bench");
    await expect(list(page)).toHaveCount(2);
    await page.getByLabel("Filter sessions").fill("thursday");
    await expect(list(page)).toHaveCount(1);
  });

  test("selecting a session shows it", async ({ page }) => {
    await list(page).filter({ hasText: "Thursday" }).click();
    await expect(detail(page)).toContainText("Thursday · Week 6");
    await expect(detail(page).getByLabel("Weight, Bench Press set 1")).toHaveValue("150");
  });

  test("an edit is saved with progress and then success", async ({ page }) => {
    await detail(page).getByLabel("Weight, Back Squat set 1").fill("230");
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    const save = page.getByRole("button", { name: "Save changes" });
    await save.click();
    await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(page.getByText("✓ Saved")).toBeVisible();
    await expect(page.getByText(/Last saved: Back Squat set 1 230×6/)).toBeVisible();
  });

  test("an invalid value blocks saving and says why", async ({ page }) => {
    await detail(page).getByLabel("Weight, Back Squat set 1").fill("abc");
    await expect(detail(page).getByText("Weight must be a number of 0 or more")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("removing a set asks first", async ({ page }) => {
    await detail(page).getByRole("button", { name: "Remove Back Squat set 2" }).click();
    await expect(page.getByRole("heading", { name: "Remove set" })).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(detail(page).getByLabel("Weight, Back Squat set 2")).toHaveCount(0);
    await expect(page.getByText("1 unsaved change")).toBeVisible();
  });

  test("discarding asks first and restores the logged values", async ({ page }) => {
    const input = detail(page).getByLabel("Weight, Back Squat set 1");
    await input.fill("230");
    await page.getByRole("button", { name: "Discard…" }).click();
    await expect(page.getByRole("heading", { name: "Discard changes" })).toBeVisible();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(input).toHaveValue("225");
  });

  test("switching sessions with unsaved edits asks first", async ({ page }) => {
    await detail(page).getByLabel("Weight, Back Squat set 1").fill("230");
    await list(page).filter({ hasText: "Thursday" }).click();
    await expect(page.getByRole("heading", { name: "Discard changes" })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(detail(page)).toContainText("Monday · Week 7");
  });

  test("deleting a session asks first and shows progress", async ({ page }) => {
    await page.getByRole("button", { name: "Delete session…" }).click();
    await expect(page.getByRole("heading", { name: "Delete session" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Deleting..." })).toBeVisible();
    await expect(list(page)).toHaveCount(2);
    await expect(detail(page)).toContainText("Thursday · Week 6");
  });
});

// Desktop Equipment page: what your equipment can load, the working weights it can't make, and the
// editors for everything you own, saved together with an unsaved-changes bar.
import { expect, test } from "@playwright/test";

test.describe("equipment workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/equipment-workspace");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const reach = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "What you can load" });
  const warnings = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /can't make/ });

  test("shows the range, steps and biggest gap of each thing you own", async ({ page }) => {
    const bar = reach(page).getByRole("row", { name: /Barbell \(45 lb\)/ });
    await expect(bar).toContainText("45–220 lb");
    await expect(bar).toContainText("5 lb");
    await expect(bar).toContainText("80 → 95");
    await expect(reach(page).getByRole("row", { name: /Kettlebells/ })).toContainText("18–26 lb");
    await expect(reach(page).getByRole("row", { name: /Barbell \(45 lb\)/ })).toContainText("2 exercises");
  });

  test("lists working weights you can't make, with the nearest you can", async ({ page }) => {
    await expect(warnings(page)).toContainText("2 working weights");
    const goblet = warnings(page).getByRole("listitem").filter({ hasText: "Goblet Squat" });
    await expect(goblet).toContainText("20 lb");
    await expect(goblet).toContainText("Nearest: 18 or 26 lb");
    await expect(warnings(page).getByRole("listitem").filter({ hasText: "Bench Press" })).toHaveCount(0);
  });

  test("editing equipment updates the report live and saves with progress, then success", async ({ page }) => {
    await page.getByRole("button", { name: "Increase 5 lb plates" }).click();
    await page.getByRole("button", { name: "Increase 5 lb plates" }).click();
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    // Two 5s a side make 85 lb possible, so the squat stops being flagged.
    await expect(warnings(page).getByRole("listitem").filter({ hasText: "Back Squat" })).toHaveCount(0);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(page.getByText("✓ Saved")).toBeVisible();
    await expect(page.getByText(/Last saved: .*5×4/)).toBeVisible();
  });

  test("discarding asks first and puts the saved equipment back", async ({ page }) => {
    await page.getByRole("button", { name: "Increase 5 lb plates" }).click();
    await page.getByRole("button", { name: "Discard…" }).click();
    await expect(page.getByRole("heading", { name: "Discard changes" })).toBeVisible();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.getByText("1 unsaved change")).toHaveCount(0);
    await expect(warnings(page).getByRole("listitem").filter({ hasText: "Back Squat" })).toHaveCount(1);
  });

  test("includes gym machines", async ({ page }) => {
    await expect(page.getByText("Machines placeholder")).toBeVisible();
  });
});

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

  test("a can't-make weight can be set to the nearest one you can make", async ({ page }) => {
    const goblet = warnings(page).getByRole("listitem").filter({ hasText: "Goblet Squat" });
    await expect(goblet.getByRole("link", { name: "Edit exercise" })).toHaveAttribute("href", "/exercises?edit=goblet");
    await goblet.getByRole("button", { name: "Use 18 lb" }).click();
    await expect(goblet.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(page.getByText("✓ Goblet Squat in Block B is now 18 lb")).toBeVisible();
    await expect(warnings(page).getByRole("listitem").filter({ hasText: "Goblet Squat" })).toHaveCount(0);
  });

  test("adds your own equipment: plate-loaded, fixed weights and no weight", async ({ page }) => {
    const items = page.getByRole("region", { name: "Your own equipment" });
    await items.getByLabel("Item name").fill("FitArc");
    await items.getByLabel("Kind").selectOption("plate_loaded");
    await items.getByLabel("Empty weight (lb)").fill("5");
    await items.getByLabel("Loaded on").selectOption("1");
    await items.getByRole("button", { name: "Add item" }).click();
    // Adding saves the item straight away: no page-level Save needed.
    await expect(items.getByRole("button", { name: "Adding…" })).toBeDisabled();
    await expect(items.getByRole("status")).toContainText("✓ Added FitArc");
    await expect(page.getByText("Saved items: FitArc")).toBeVisible();
    await expect(page.getByText(/unsaved change/)).toHaveCount(0);
    await expect(items.getByRole("listitem").filter({ hasText: "FitArc" })).toContainText("5 lb empty · plates on one side");
    await expect(reach(page).getByRole("row", { name: /FitArc/ })).toContainText("5–");

    await items.getByLabel("Item name").fill("Medicine balls");
    await items.getByLabel("Kind").selectOption("fixed");
    await items.getByLabel("Weights (lb)").fill("9, 2, 6");
    await items.getByRole("button", { name: "Add item" }).click();
    await expect(reach(page).getByRole("row", { name: /Medicine balls/ })).toContainText("2–9 lb");
    await expect(page.getByText("Saved items: FitArc, Medicine balls")).toBeVisible();

    await items.getByLabel("Item name").fill("Stability ball");
    await items.getByLabel("Kind").selectOption("none");
    await items.getByRole("button", { name: "Add item" }).click();
    await expect(items.getByRole("listitem").filter({ hasText: "Stability ball" })).toContainText(/^Stability ballNo weightEdit/);
    await expect(reach(page).getByRole("row", { name: /Stability ball/ })).toHaveCount(0);
  });

  test("an item needs a valid weight, and removing one asks first", async ({ page }) => {
    const items = page.getByRole("region", { name: "Your own equipment" });
    await items.getByLabel("Item name").fill("Pin");
    await items.getByLabel("Kind").selectOption("plate_loaded");
    await items.getByRole("button", { name: "Add item" }).click();
    await expect(items.getByText("Enter what it weighs empty, in lb (0 if nothing).")).toBeVisible();
    await items.getByLabel("Empty weight (lb)").fill("0");
    await items.getByRole("button", { name: "Add item" }).click();
    await items.getByRole("button", { name: "Remove Pin…" }).click();
    await expect(page.getByRole("heading", { name: "Remove Pin" })).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(items.getByRole("listitem").filter({ hasText: "Pin" })).toHaveCount(0);
    await expect(items.getByRole("status")).toContainText("✓ Removed Pin");
    await expect(page.getByText("Saved items: none")).toBeVisible();
  });

  test("saving an item leaves your other unsaved edits unsaved", async ({ page }) => {
    await page.getByRole("button", { name: "Increase 5 lb plates" }).click();
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    const items = page.getByRole("region", { name: "Your own equipment" });
    await items.getByLabel("Item name").fill("Stability ball");
    await items.getByLabel("Kind").selectOption("none");
    await items.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Saved items: Stability ball")).toBeVisible();
    await expect(page.getByText(/Last saved: .*5×3/)).toHaveCount(0); // the extra 5 lb plate wasn't saved with it
    await expect(page.getByText("1 unsaved change")).toBeVisible();     // and are still waiting
  });

  test("a failed item save keeps the form filled and the item out of the list", async ({ page }) => {
    const items = page.getByRole("region", { name: "Your own equipment" });
    await items.getByLabel("Item name").fill("boom");
    await items.getByLabel("Kind").selectOption("none");
    await items.getByRole("button", { name: "Add item" }).click();
    await expect(items.getByRole("button", { name: "Add item" })).toBeEnabled();
    await expect(items.getByLabel("Item name")).toHaveValue("boom");
    await expect(items.getByRole("listitem").filter({ hasText: "boom" })).toHaveCount(0);
    await expect(page.getByText("Saved items: none")).toBeVisible();
  });

  test("includes gym machines", async ({ page }) => {
    await expect(page.getByText("Machines placeholder")).toBeVisible();
  });
});

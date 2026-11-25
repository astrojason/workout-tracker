// Settings → Warm-ups: a rule per equipment group, shared limits, and a live preview of the
// warm-up sets your own lifts would get on your equipment.
import { expect, test, type Page } from "@playwright/test";

test.describe("warm-up rules", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/warmup-rules");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const editor = (page: Page) => page.getByRole("region", { name: "Warm-ups" });
  const group = (page: Page, name: string) => editor(page).getByRole("region", { name });
  const lift = (page: Page, name: string) => editor(page).getByRole("region", { name: "What you'd get" }).getByRole("listitem").filter({ hasText: name });

  test("previews each lift's warm-up from the saved rules", async ({ page }) => {
    await expect(lift(page, "Back Squat")).toContainText("45 lb× 8");
    await expect(lift(page, "Back Squat")).toContainText("145 lb× 2"); // 80% of 185 is 148: your plates make 145
    // A 15 lb kettlebell with nothing lighter: the work bell for fewer reps.
    await expect(lift(page, "KB Swing")).toContainText("You own nothing lighter");
    await expect(lift(page, "KB Swing")).not.toContainText(/(^|[^\d.])5 lb×/);
  });

  test("editing a ramp step updates the preview, then saves with progress and success", async ({ page }) => {
    const plates = group(page, "Barbells and plate-loaded");
    await plates.getByRole("button", { name: "Raise step 3 percent" }).click();
    await expect(lift(page, "Back Squat")).toContainText("155 lb× 2"); // 85% of 185
    await expect(page.getByText("1 unsaved change")).toBeVisible();
    await editor(page).getByRole("button", { name: "Save" }).click();
    await expect(editor(page).getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(editor(page).getByText("✓ Saved")).toBeVisible();
    await expect(page.getByText(/Saved rules: .*"pct":85/)).toBeVisible();
  });

  test("a group set to None gets no warm-up", async ({ page }) => {
    await group(page, "Fixed weights").getByRole("radio", { name: "None" }).click();
    await expect(lift(page, "KB Swing")).toContainText("No warm-up");
  });

  test("steps can be added and removed", async ({ page }) => {
    const plates = group(page, "Barbells and plate-loaded");
    await plates.getByRole("button", { name: "Remove step 3" }).click();
    await expect(lift(page, "Back Squat")).not.toContainText("145 lb");
    await plates.getByRole("button", { name: "Add a step" }).click();
    await expect(plates.getByText("Step 3")).toBeVisible();
  });

  test("discarding asks first and puts the saved rules back", async ({ page }) => {
    await group(page, "Fixed weights").getByRole("radio", { name: "None" }).click();
    await editor(page).getByRole("button", { name: "Discard…" }).click();
    await expect(page.getByRole("heading", { name: "Discard warm-up changes" })).toBeVisible();
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(group(page, "Fixed weights").getByRole("radio", { name: "One lighter set" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/unsaved change/)).toHaveCount(0);
  });

  test("a failed save keeps your edits and shows the error", async ({ page }) => {
    await editor(page).getByRole("button", { name: "Lower the limit" }).click();
    await page.getByRole("button", { name: "Make the next save fail" }).click();
    await editor(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
    await expect(page.getByText(/Preview save failed/).first()).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("1 unsaved change")).toBeVisible();
  });
});

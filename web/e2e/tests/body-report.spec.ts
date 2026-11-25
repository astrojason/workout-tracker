// Desktop Body page: measurement trends, logging and editing check-ins, tape changes, left vs right
// and the measurement history. Phones keep the existing body metrics section.
import { expect, test } from "@playwright/test";

test.describe("body report", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/body-report");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const table = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Measurements" });
  const form = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /check-in/i });

  test("headline numbers show the latest value and the change over the range", async ({ page }) => {
    await expect(page.getByTestId("kpi-weight")).toContainText("184.2");
    await expect(page.getByTestId("kpi-weight")).toContainText("▼ 3.1 lb");
    await expect(page.getByTestId("kpi-waist")).toContainText("33.5");
    await page.getByRole("button", { name: "4 wk" }).click();
    await expect(page.getByTestId("kpi-weight")).not.toContainText("3.1");
  });

  test("the trend chart switches measurement", async ({ page }) => {
    await expect(page.getByRole("img", { name: /^Body weight over/ })).toBeVisible();
    await page.getByRole("group", { name: "Measurement" }).getByRole("button", { name: "Waist" }).click();
    await expect(page.getByRole("img", { name: /^Waist over/ })).toBeVisible();
  });

  test("logging a check-in shows progress, then success, and adds it to the table", async ({ page }) => {
    await form(page).getByLabel("Body weight (lbs)").fill("183.9");
    await form(page).getByLabel("Waist (in)").fill("33.25");
    await form(page).getByRole("button", { name: "Save check-in" }).click();
    await expect(form(page).getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(form(page).getByText("✓ Saved")).toBeVisible();
    await expect(table(page).locator("tbody tr").first()).toContainText("183.9");
  });

  test("a check-in needs at least one value", async ({ page }) => {
    await form(page).getByRole("button", { name: "Save check-in" }).click();
    await expect(form(page).getByText("Fill in at least one measurement")).toBeVisible();
  });

  test("a failed save shows the error and keeps what was typed", async ({ page }) => {
    await form(page).getByLabel("Body weight (lbs)").fill("999");
    await form(page).getByRole("button", { name: "Save check-in" }).click();
    await expect(page.getByText("Preview: saving the check-in failed")).toBeVisible();
    await page.getByRole("button", { name: /close|dismiss/i }).first().click();
    await expect(form(page).getByLabel("Body weight (lbs)")).toHaveValue("999");
  });

  test("a check-in can be edited from the table", async ({ page }) => {
    await table(page).locator("tbody tr").first().getByRole("button", { name: /^Edit/ }).click();
    await expect(form(page).getByRole("heading", { name: /^Edit .* check-in$/ })).toBeVisible();
    const weight = form(page).getByLabel("Body weight (lbs)");
    await expect(weight).toHaveValue("184.2");
    await weight.fill("184");
    await form(page).getByRole("button", { name: "Save changes" }).click();
    await expect(table(page).locator("tbody tr").first()).toContainText("184 lb");
    await expect(form(page).getByRole("heading", { name: "Log a check-in" })).toBeVisible();
  });

  test("deleting a check-in asks first", async ({ page }) => {
    const first = table(page).locator("tbody tr").first();
    await expect(first).toContainText("184.2 lb");
    await first.getByRole("button", { name: /^Delete/ }).click();
    await expect(page.getByRole("heading", { name: "Delete check-in" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delete check-in" })).toHaveCount(0);
    await expect(first).toContainText("184.5 lb");
    await expect(page.getByText(/^11 check-ins in/)).toBeVisible();
  });

  test("tape changes and left vs right are reported", async ({ page }) => {
    const tape = page.getByRole("region", { name: /Tape changes/ });
    await expect(tape.getByRole("listitem").filter({ hasText: "Waist" })).toContainText("−0.75");
    const sides = page.getByRole("region", { name: "Left vs right" });
    await expect(sides.getByRole("row", { name: /Thigh/ })).toContainText("Right +0.5");
    await expect(sides.getByRole("row", { name: /Calf/ })).toContainText("Even");
  });

  test("exports the check-ins as CSV and offers spreadsheet import", async ({ page }) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    expect((await download).suggestedFilename()).toBe("body-measurements.csv");
    await expect(page.getByLabel("Measurements spreadsheet")).toBeAttached();
  });
});

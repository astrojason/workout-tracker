// Desktop Overview: at desktop widths Home leads with a reporting dashboard (headline numbers,
// weekly volume, consistency, an editable lift table, recent sessions, progression changes).
// The preview page renders the report with fixed sessions so the numbers are known.
import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 1000 };

test.describe("desktop overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/test-preview/overview");
    // On a cold dev server the page can render before React hydrates; input typed then is reset.
    await page.locator("main[data-hydrated]").waitFor();
  });

  test("headline numbers come from the sessions in the range", async ({ page }) => {
    const kpis = page.getByRole("region", { name: "Key numbers" });
    await expect(kpis.getByTestId("kpi-sessions")).toContainText("3");
    // 3 sessions: squat 225×5 + 225×5, squat 215×5, bench 155×5 → 2250 + 1075 + 775
    await expect(kpis.getByTestId("kpi-volume")).toContainText("4,100");
    await expect(kpis.getByTestId("kpi-duration")).toContainText("50 min");
    await expect(kpis.getByTestId("kpi-bodyweight")).toContainText("184.5");
  });

  test("the comparison sits on its own smaller, fainter line under the change", async ({ page }) => {
    await page.getByRole("button", { name: "4 wk" }).click();
    const tile = page.getByTestId("kpi-sessions");
    const change = tile.getByText("▲ 1", { exact: true });
    const note = tile.getByText("vs prior 4 wk", { exact: true });
    await expect(change).toBeVisible();
    await expect(note).toBeVisible();
    const [c, n] = [(await change.boundingBox())!, (await note.boundingBox())!];
    expect(n.y).toBeGreaterThanOrEqual(c.y + c.height - 1);
    const size = (el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize);
    expect(await note.evaluate(size)).toBeLessThan(await change.evaluate(size));
    const color = (el: HTMLElement) => getComputedStyle(el).color;
    expect(await note.evaluate(color)).not.toBe(await change.evaluate(color));
  });

  test("the range buttons change the period the numbers cover", async ({ page }) => {
    const twelve = page.getByRole("button", { name: "12 wk" });
    await expect(twelve).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "4 wk" }).click();
    await expect(page.getByRole("button", { name: "4 wk" })).toHaveAttribute("aria-pressed", "true");
    // The 215 lb squat session is six weeks old, so it drops out of a four-week range.
    await expect(page.getByTestId("kpi-sessions")).toContainText("2");
  });

  test("weekly volume and consistency are drawn", async ({ page }) => {
    await expect(page.getByRole("img", { name: /Weekly volume/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Consistency" }).getByTitle(/Completed/).first()).toBeVisible();
  });

  test("the lift table links each lift to its report and shows its program weight", async ({ page }) => {
    const lifts = page.getByRole("region", { name: "Lift progression" });
    await expect(lifts.getByRole("link", { name: "Back Squat" })).toHaveAttribute("href", "/exercise/Back%20Squat");
    await expect(lifts.getByLabel("Working weight for Back Squat")).toHaveValue("230");
    await expect(lifts.getByRole("row", { name: /Back Squat/ })).toContainText("+10 lb");
  });

  test("editing a working weight saves it, showing progress and then success", async ({ page }) => {
    const input = page.getByLabel("Working weight for Back Squat");
    await input.fill("235");
    await input.press("Enter");
    const row = page.getByRole("row", { name: /Back Squat/ });
    await expect(row.getByText("Saving…")).toBeVisible();
    await expect(input).toBeDisabled();
    await expect(row.getByText("Saved")).toBeVisible();
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("235");
  });

  test("a weight that fails to save shows the error and puts the old weight back", async ({ page }) => {
    const input = page.getByLabel("Working weight for Bench Press");
    await input.fill("160");
    await input.press("Enter");
    await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
    await expect(page.getByText("Preview: saving Bench Press failed")).toBeVisible();
    await expect(input).toHaveValue("155");
  });

  test("a weight that isn't a number is refused before saving", async ({ page }) => {
    const input = page.getByLabel("Working weight for Back Squat");
    await input.fill("abc");
    await input.press("Enter");
    await expect(page.getByRole("row", { name: /Back Squat/ }).getByText("Enter a weight above 0")).toBeVisible();
  });

  test("lifts are sorted by how much they improved", async ({ page }) => {
    const names = await page.getByRole("region", { name: "Lift progression" }).locator("tbody tr td:first-child a").allTextContents();
    // Plank 60s → 90s (+50%), pull-up 3 → 2 bands (+33%), squat 215 → 225 lb (+5%), bench once (0%).
    expect(names).toEqual(["Plank", "Assisted Pull-up", "Back Squat", "Bench Press"]);
  });

  test("assisted pull-ups are shown in bands, not pounds", async ({ page }) => {
    const row = page.getByRole("row", { name: /Assisted Pull-up/ });
    await expect(row).toContainText("−1 band");
    await expect(row).toContainText("2 bands × 6");
    await expect(row).not.toContainText(" lb");
    await expect(row.getByLabel("Working weight for Assisted Pull-up")).toHaveValue("2");
    await expect(row).toContainText("bands");
    await expect(page.getByRole("region", { name: "Progression changes" }).getByText("3 → 2 bands")).toBeVisible();
  });

  test("timed exercises are shown as time, including the change", async ({ page }) => {
    const row = page.getByRole("row", { name: /Plank/ });
    await expect(row).toContainText("+30s");
    await expect(row).toContainText("1:30");
    await expect(row).not.toContainText(" lb");
    await expect(row.getByLabel("Working weight for Plank")).toHaveCount(0);
  });

  test("the consistency grid covers the selected range", async ({ page }) => {
    const days = page.getByRole("region", { name: "Consistency" }).getByTestId("consistency-day");
    await expect(days).toHaveCount(12 * 7);
    await page.getByRole("button", { name: "4 wk" }).click();
    await expect(days).toHaveCount(4 * 7);
    await expect(page.getByRole("region", { name: "Consistency" })).toContainText("in the last 4 weeks");
    await page.getByRole("button", { name: "1 yr" }).click();
    await expect(days).toHaveCount(52 * 7);
    // A year still fits in the card without scrolling the page sideways.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the consistency card shows the current streak", async ({ page }) => {
    const card = page.getByRole("region", { name: "Consistency" });
    await expect(card).toContainText("5 day streak");
    await expect(card).toContainText("This week: 2/4 planned sessions");
  });

  test("recent sessions link to their detail pages and progression changes are listed", async ({ page }) => {
    const recent = page.getByRole("region", { name: "Recent sessions" });
    await expect(recent.locator('a[href="/session/s1"]')).toBeVisible();
    const changes = page.getByRole("region", { name: "Progression changes" });
    await expect(changes.getByText("Back Squat")).toBeVisible();
    await expect(changes.getByText("225 → 230 lb")).toBeVisible();
  });
});

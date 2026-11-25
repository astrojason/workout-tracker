// Desktop Exercises page: your exercise library, each row leading to the exercise's report.
// (The Programs page is covered by programs-manager.spec.ts.)
import { expect, test } from "@playwright/test";

test.describe("programs and exercises", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/library-index");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const exercises = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Exercises" });



  test("lists the exercise library, linking each to its report", async ({ page }) => {
    await expect(exercises(page).locator("tbody tr")).toHaveCount(3);
    const squat = exercises(page).getByRole("row", { name: /Back Squat/ });
    await expect(squat.getByRole("link", { name: "Back Squat", exact: true })).toHaveAttribute("href", "/exercise/Back%20Squat");
    await expect(squat).toContainText("Barbell 45");
    await expect(squat).toContainText("Quads · Glutes");
    await expect(exercises(page).getByRole("row", { name: /Hammer Curl/ })).toContainText("Never");
    await expect(squat.getByRole("button", { name: "Edit Back Squat" })).toBeVisible();
  });

  test("filters exercises by search and equipment", async ({ page }) => {
    await exercises(page).getByLabel("Search exercises").fill("pull");
    await expect(exercises(page).locator("tbody tr")).toHaveCount(1);
    await exercises(page).getByLabel("Search exercises").fill("");
    await exercises(page).getByLabel("Equipment").selectOption("dumbbell");
    await expect(exercises(page).locator("tbody tr")).toHaveCount(1);
    await expect(exercises(page).getByRole("row", { name: /Hammer Curl/ })).toBeVisible();
  });

  // Editing happens here on desktop, in a panel that slides in from the right (not the phone page).
  test.describe("editing an exercise", () => {
    const panel = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Edit Back Squat" });

    test("opens a desktop panel on the right with the form in two columns", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await expect(panel(page)).toBeVisible();
      const box = (await panel(page).boundingBox())!;
      expect(box.x + box.width).toBeGreaterThan(1430);
      expect(box.width).toBeGreaterThan(500);
      const name = (await panel(page).getByLabel("Name").boundingBox())!;
      const brand = (await panel(page).getByLabel("Brand (optional)").boundingBox())!;
      expect(Math.abs(name.y - brand.y)).toBeLessThan(4); // side by side
      await expect(panel(page).getByRole("button", { name: "Save" })).toBeInViewport();
    });

    test("saves and shows the change in the table", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await panel(page).getByLabel("Name").fill("Front Squat");
      await panel(page).getByRole("button", { name: "Save" }).click();
      await expect(panel(page)).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText("Saved Front Squat");
      await expect(exercises(page).getByRole("row", { name: /Front Squat/ })).toBeVisible();
    });

    test("closes without saving on Close or Escape", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await panel(page).getByRole("button", { name: "Close" }).click();
      await expect(panel(page)).toHaveCount(0);
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await page.keyboard.press("Escape");
      await expect(panel(page)).toHaveCount(0);
    });

    test("reports a failed save and keeps the panel open", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await panel(page).getByLabel("Name").fill("boom");
      await panel(page).getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
      await expect(page.getByText(/Preview save failed/).first()).toBeVisible();
    });

    test("has one Equipment dropdown, listing only the equipment you own", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      const equipment = panel(page).getByLabel("Equipment", { exact: true });
      await expect(panel(page).getByLabel("Equipment item")).toHaveCount(0);
      await expect(panel(page).getByLabel("Gym machine")).toHaveCount(0);
      const options = await equipment.locator("option").allTextContents();
      expect(options).toContain("Olympic bar (45 lb)");
      expect(options).toContain("FitArc");
      expect(options).toContain("Chest press");
      expect(options).not.toContain("EZ bar (15 lb)"); // not owned in the fixture
      expect(options).not.toContain("PowerBlock (5–50 lb)");
      await expect(equipment).toHaveValue("type:barbell_45");
    });

    test("picking one of your items saves the exercise on it", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await panel(page).getByLabel("Equipment", { exact: true }).selectOption({ label: "FitArc" });
      await panel(page).getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status")).toContainText("Saved Back Squat");
      await expect(exercises(page).getByRole("row", { name: /Back Squat/ })).toContainText("FitArc");
    });

    test("bands pick a colour from the bands you own", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      await panel(page).getByLabel("Equipment", { exact: true }).selectOption({ label: "Serious Steel bands (Red, Blue)" });
      const colours = await panel(page).getByLabel("Band colour").locator("option").allTextContents();
      expect(colours).toEqual(["Red", "Blue"]);
    });

    test("progression rules follow the equipment: plate pairs on a barbell, single plates on the FitArc", async ({ page }) => {
      await exercises(page).getByRole("button", { name: "Edit Back Squat" }).click();
      const rule = panel(page).getByLabel("Progression Rule");
      const ruleOptions = () => rule.locator("optgroup[label='Add weight'] option").allTextContents();
      expect(await ruleOptions()).toEqual(["Next weight step (as little as 0.5 lb)", "Add 1 lb", "Add 1.5 lb", "Add 2 lb", "Add 5 lb", "Add 10 lb", "Add 20 lb"]);
      await panel(page).getByLabel("Equipment", { exact: true }).selectOption({ label: "FitArc" });
      expect(await ruleOptions()).toContain("Add 0.5 lb");
      // Back Squat's Add 5 lb is still possible on the FitArc (one 5 lb plate), so it stays chosen.
      await expect(rule).toHaveValue("add_5lb");
      await rule.selectOption({ label: "Add 0.5 lb" });
      await panel(page).getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status")).toContainText("Saved Back Squat");
    });

    test("opens straight on the exercise named in ?edit=", async ({ page }) => {
      await page.goto("/test-preview/library-index?edit=squat");
      await page.locator("main[data-hydrated]").waitFor();
      await expect(panel(page)).toBeVisible();
    });
  });
});

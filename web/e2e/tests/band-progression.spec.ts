// Banded exercises can progress to the next band: the exercise editor offers a "Next band" rule
// for Serious Steel bands and loop bands (end-of-workout progression is covered in vitest).
import { expect, test } from "@playwright/test";

async function newExercisePanel(page: import("@playwright/test").Page) {
  await page.goto("/test-preview/exercise-editor");
  await page.locator("main[data-hydrated]").waitFor();
  const panel = page.getByRole("dialog", { name: "Edit Exercise" });
  await panel.locator("div:has(> label:text-is('Exercise')) select").selectOption("__new__");
  return panel;
}

for (const [value, label] of [["band", "Serious Steel Band"], ["loop_band", "Loop Band"]] as const) {
  test(`a new ${label} exercise can use the Next band rule`, async ({ page }) => {
    const panel = await newExercisePanel(page);
    await panel.locator("div:has(> label:text-is('Equipment')) select").selectOption(value);
    const rule = panel.locator("div:has(> label:text-is('Progression Rule')) select");
    await expect(rule.locator("option", { hasText: "Next band" })).toHaveCount(1);
    await rule.selectOption("next_band");
    await expect(rule).toHaveValue("next_band");
  });
}

test("a barbell exercise isn't offered the Next band rule", async ({ page }) => {
  const panel = await newExercisePanel(page);
  await panel.locator("div:has(> label:text-is('Equipment')) select").selectOption("barbell_45");
  const rule = panel.locator("div:has(> label:text-is('Progression Rule')) select");
  await expect(rule.locator("option", { hasText: "Next band" })).toHaveCount(0);
});

// A custom, build-it-as-you-go workout: pick an exercise, enter weight and reps per set,
// repeat, then finish.
import { expect, test } from "@playwright/test";

test.describe("custom workout builder", () => {
  test("logs sets for an exercise, keeping the exercise and weight for the next set", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");

    await page.getByLabel("Exercise").fill("Bench Press");
    await page.getByLabel("Weight", { exact: true }).fill("135");
    await page.getByLabel("Reps", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Add set" }).click();

    await expect(page.getByTestId("logged-set")).toHaveCount(1);
    await expect(page.getByTestId("logged-set").first()).toContainText("135");
    await expect(page.getByTestId("logged-set").first()).toContainText("8");

    // Same exercise stays selected and the weight carries over; reps are re-entered.
    await expect(page.getByLabel("Exercise")).toHaveValue("Bench Press");
    await expect(page.getByLabel("Weight", { exact: true })).toHaveValue("135");

    await page.getByLabel("Reps", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(page.getByTestId("logged-set")).toHaveCount(2);
  });

  test("won't add a set without an exercise and reps", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");
    await expect(page.getByRole("button", { name: "Add set" })).toBeDisabled();
    await page.getByLabel("Exercise").fill("Row");
    await expect(page.getByRole("button", { name: "Add set" })).toBeDisabled();
    await page.getByLabel("Reps", { exact: true }).fill("10");
    await expect(page.getByRole("button", { name: "Add set" })).toBeEnabled();
  });

  test("switches to another exercise and groups sets under each", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");

    await page.getByLabel("Exercise").fill("Bench Press");
    await page.getByLabel("Weight", { exact: true }).fill("135");
    await page.getByLabel("Reps", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Add set" }).click();

    await page.getByRole("button", { name: "Change exercise" }).click();
    await expect(page.getByLabel("Exercise")).toHaveValue("");
    await page.getByLabel("Exercise").fill("Row");
    await page.getByLabel("Weight", { exact: true }).fill("100");
    await page.getByLabel("Reps", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Add set" }).click();

    await expect(page.getByTestId("exercise-group")).toHaveCount(2);
    await expect(page.getByTestId("exercise-group").nth(0)).toContainText("Bench Press");
    await expect(page.getByTestId("exercise-group").nth(1)).toContainText("Row");
  });

  test("suggests library exercises", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");
    await expect(page.locator("datalist option[value='Deadlift']")).toHaveCount(1);
  });

  test("can remove a logged set", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");
    await page.getByLabel("Exercise").fill("Curl");
    await page.getByLabel("Reps", { exact: true }).fill("12");
    await page.getByRole("button", { name: "Add set" }).click();
    await page.getByRole("button", { name: /remove set/i }).click();
    await expect(page.getByTestId("logged-set")).toHaveCount(0);
  });

  test("finishing hands the logged sets to the saver and shows a summary", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");
    await expect(page.getByRole("button", { name: "Finish workout" })).toBeDisabled();

    await page.getByLabel("Exercise").fill("Bench Press");
    await page.getByLabel("Weight", { exact: true }).fill("135");
    await page.getByLabel("Reps", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Add set" }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();

    await expect(page.getByText("Workout saved")).toBeVisible();
    await expect(page.getByTestId("saved-payload")).toHaveText("Bench Press:135x8");
  });
});

test.describe("custom workout time and bodyweight", () => {
  test("logs a timed set in seconds", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");
    await page.getByLabel("Exercise").fill("Plank");
    await page.getByRole("button", { name: "Time" }).click();
    await expect(page.getByLabel("Reps", { exact: true })).toHaveCount(0);
    await page.getByLabel("Time (sec)").fill("45");
    await page.getByRole("button", { name: "Add set" }).click();

    await expect(page.getByTestId("logged-set").first()).toContainText("45s");
    await page.getByRole("button", { name: "Finish workout" }).click();
    await expect(page.getByTestId("saved-payload")).toHaveText("Plank:BWx45s");
  });

  test("bodyweight toggle disables and clears the weight", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");
    await page.getByLabel("Exercise").fill("Pull-up");
    await page.getByLabel("Weight", { exact: true }).fill("25");
    await page.getByRole("switch", { name: "Bodyweight" }).click();
    await expect(page.getByLabel("Weight", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Weight", { exact: true })).toHaveValue("");

    await page.getByLabel("Reps", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(page.getByTestId("logged-set").first()).toContainText("BW");
    // Toggle and exercise carry over to the next set.
    await expect(page.getByRole("switch", { name: "Bodyweight" })).toBeChecked();
  });
});

test("shows an estimated 1RM per weighted rep set, but not for bodyweight or timed sets", async ({ page }) => {
  await page.goto("/test-preview/custom-workout");
  await page.getByLabel("Exercise").fill("Bench Press");
  await page.getByLabel("Weight", { exact: true }).fill("135");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Add set" }).click();
  await expect(page.getByTestId("set-e1rm")).toHaveText("est. 1RM 171 lb");

  await page.getByRole("switch", { name: "Bodyweight" }).click();
  await page.getByLabel("Reps", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Add set" }).click();
  await expect(page.getByTestId("logged-set")).toHaveCount(2);
  await expect(page.getByTestId("set-e1rm")).toHaveCount(1);
});

test("a set can be rated, the rating resets to normal for the next set, and it is shown in the log", async ({ page }) => {
  await page.goto("/test-preview/custom-workout");
  await page.getByLabel("Exercise").fill("Bench Press");
  await page.getByLabel("Weight", { exact: true }).fill("135");
  await page.getByLabel("Reps", { exact: true }).fill("8");
  await expect(page.getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Hard" }).click();
  await page.getByRole("button", { name: "Add set" }).click();

  await expect(page.getByTestId("logged-set").first()).toContainText("hard");
  await expect(page.getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");
});

test("suggests a weight for an exercise with history, applied with one tap", async ({ page }) => {
  await page.goto("/test-preview/custom-workout");
  await expect(page.getByTestId("weight-suggestion")).toHaveCount(0);
  await page.getByLabel("Exercise").fill("Bench Press");
  await expect(page.getByTestId("weight-suggestion")).toContainText("Suggested 140 lb");
  await expect(page.getByTestId("weight-suggestion")).toContainText("last time 135 lb × 8");
  await page.getByRole("button", { name: "Use 140 lb" }).click();
  await expect(page.getByLabel("Weight", { exact: true })).toHaveValue("140");
  await expect(page.getByTestId("weight-suggestion")).toHaveCount(0);

  // Not offered for bodyweight sets or an exercise with no history.
  await page.getByLabel("Exercise").fill("Row");
  await expect(page.getByTestId("weight-suggestion")).toHaveCount(0);
});

test.describe("custom workout set timer", () => {
  test("counts up since the last set, resets when another is added, and never blocks entry", async ({ page }) => {
    await page.clock.install();
    await page.goto("/test-preview/custom-workout");
    await expect(page.getByTestId("set-timer")).toHaveCount(0);

    await page.getByLabel("Exercise").fill("Bench Press");
    await page.getByLabel("Reps", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(page.getByTestId("set-timer")).toContainText("0:00");

    await page.clock.fastForward(75_000);
    await expect(page.getByTestId("set-timer")).toContainText("1:15");

    // Not UI blocking: the form stays usable while the timer runs.
    await page.getByLabel("Reps", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(page.getByTestId("set-timer")).toContainText("0:00");
    await expect(page.getByTestId("logged-set")).toHaveCount(2);
  });
});

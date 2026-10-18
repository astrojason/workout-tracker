// Uploading a photo of equipment while building a custom workout: the AI names the exercise
// and suggests a working weight from the user's history; failures show the real error.
import { expect, test } from "@playwright/test";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("equipment photo scan in the custom workout", () => {
  test("fills in the exercise name and suggested weight from a photo", async ({ page }) => {
    await page.goto("/test-preview/custom-workout");

    await page.getByTestId("equipment-photo-input").setInputFiles({ name: "row.png", mimeType: "image/png", buffer: PNG });

    await expect(page.getByLabel("Exercise")).toHaveValue("Seated Cable Row");
    await expect(page.getByLabel("Weight")).toHaveValue("80");
    await expect(page.getByText("Based on your Lat Pulldown at 90 lbs")).toBeVisible();

    await page.getByLabel("Reps").fill("10");
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(page.getByTestId("logged-set").first()).toContainText("80");
  });

  test("shows the actual error in the error modal when the scan fails", async ({ page }) => {
    await page.goto("/test-preview/custom-workout?fail=1");

    await page.getByTestId("equipment-photo-input").setInputFiles({ name: "row.png", mimeType: "image/png", buffer: PNG });

    await expect(page.getByText("OpenAI API error 529: overloaded")).toBeVisible();
    await expect(page.getByLabel("Exercise")).toHaveValue("");
  });
});

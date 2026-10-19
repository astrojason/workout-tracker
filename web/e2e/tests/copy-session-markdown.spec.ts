// Verifies a logged workout can be copied from the History page as a Markdown document.
import { expect, test } from "@playwright/test";

test.describe("copy a workout as Markdown", () => {
  test("copies the whole workout, sets and notes included", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/test-preview/copy-session");

    await page.getByRole("button", { name: "Copy workout as Markdown" }).click();
    await expect(page.getByText("Copied!")).toBeVisible();

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("# Reacher Build — Monday, Week 2");
    expect(text).toContain("## Squat");
    expect(text).toContain("1. 5 reps @ 135 lb — easy");
    expect(text).toContain("2. 4 reps @ 135 lb — hard — left knee tight");
  });
});

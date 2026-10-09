// The app version is shown in a footer rendered by the root layout, so every page has it.
import { expect, test } from "@playwright/test";
import { version } from "../../package.json";

for (const path of ["/test-preview/program-card", "/test-preview/session-notes", "/settings"]) {
  test(`shows the app version in the footer on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("contentinfo")).toContainText(`v${version}`);
    await expect(page.getByText(`Workout Tracker v${version}`)).toHaveCount(1);
  });
}

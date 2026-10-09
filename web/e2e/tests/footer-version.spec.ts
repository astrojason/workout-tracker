// The app version is shown inside the bottom navigation bar (the footer with the controls),
// not as a separate line beneath it.
import { expect, test } from "@playwright/test";
import { version } from "../../package.json";

test("shows the app version inside the bottom nav, alongside its controls", async ({ page }) => {
  await page.goto("/test-preview/bottom-nav");

  const nav = page.getByRole("navigation");
  await expect(nav).toContainText(`v${version}`);
  await expect(nav.getByRole("link", { name: /settings/i })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.getByText(`v${version}`)).toHaveCount(1);
});

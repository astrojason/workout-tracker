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

test("the version number in the bottom nav is a link to /changelog", async ({ page }) => {
  await page.goto("/test-preview/bottom-nav");

  const nav = page.getByRole("navigation");
  const versionLink = nav.getByRole("link", { name: `v${version}` });
  await expect(versionLink).toBeVisible();
  await expect(versionLink).toHaveAttribute("href", "/changelog");
});

test("the History page keeps its footer (nav + version) when signed out", async ({ page }) => {
  await page.goto("/history");

  await expect(page.getByText("Sign in to view history.")).toBeVisible();
  const nav = page.getByRole("navigation");
  await expect(nav).toContainText(`v${version}`);
  await expect(nav.getByRole("link", { name: /history/i })).toBeVisible();
});

// The footer should stay slim: icons, labels and the version on one compact bar.
test("the bottom nav is compact and keeps the version on the same row as the tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-preview/bottom-nav");

  const nav = page.getByRole("navigation");
  const navBox = (await nav.boundingBox())!;
  expect(navBox.height).toBeLessThanOrEqual(64);

  const tabBox = (await nav.getByRole("link", { name: /settings/i }).boundingBox())!;
  const versionBox = (await nav.getByRole("link", { name: /^v\d/ }).boundingBox())!;
  const tabCenter = tabBox.y + tabBox.height / 2;
  expect(versionBox.y).toBeLessThan(tabCenter + tabBox.height / 2); // not on a row beneath the tabs
});

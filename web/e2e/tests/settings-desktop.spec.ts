// Desktop Settings: only what isn't elsewhere in the top bar (default rest, sound, account, about),
// with links to the tabs that took the rest.
import { expect, test } from "@playwright/test";

test.describe("desktop settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/settings-desktop");
    await page.locator("main[data-hydrated]").waitFor();
  });

  test("changing the default rest saves with progress and then success", async ({ page }) => {
    const rest = page.getByRole("group", { name: "Default rest" });
    await expect(rest.getByRole("button", { name: "120s" })).toHaveAttribute("aria-pressed", "true");
    await rest.getByRole("button", { name: "90s" }).click();
    await expect(page.getByText("Saving…")).toBeVisible();
    await expect(page.getByText("✓ Saved · 1:30 between sets")).toBeVisible();
    await expect(rest.getByRole("button", { name: "90s" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the timer sound switch toggles", async ({ page }) => {
    const sound = page.getByRole("switch", { name: "Timer sound" });
    await expect(sound).toHaveAttribute("aria-checked", "true");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-checked", "false");
  });

  test("shows the account, version and changelog, and signs out", async ({ page }) => {
    await expect(page.getByText("you@example.com")).toBeVisible();
    await expect(page.getByRole("link", { name: /What's new/ })).toHaveAttribute("href", "/changelog");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText("Signed out")).toBeVisible();
  });

  test("points to the tabs that took over the rest", async ({ page }) => {
    const moved = page.getByRole("region", { name: "Moved to the top bar" });
    for (const [name, href] of [["Programs", "/programs"], ["Exercise library", "/exercises"], ["Equipment and gym machines", "/equipment"], ["Body measurements", "/body"]]) {
      await expect(moved.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
    }
  });
});

// Desktop layout (design "1a Centered workspace"): at desktop widths the bottom nav becomes a top
// bar, cards flatten into sections with divider lines, and Home gains an "Up today" list beside the
// program cards (recent sessions moved into the Overview, see desktop-overview.spec.ts). Phone widths keep the existing layout.
import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

test.describe("top bar", () => {
  test("at desktop width the nav is a top bar with the app name and tabs in a row", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/test-preview/bottom-nav");

    const nav = page.getByRole("navigation");
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y).toBe(0);
    expect(navBox.height).toBeLessThanOrEqual(64);
    await expect(nav.getByText("Workout Tracker")).toBeVisible();

    const home = (await nav.getByRole("link", { name: /home/i }).boundingBox())!;
    const history = (await nav.getByRole("link", { name: /history/i }).boundingBox())!;
    const settings = (await nav.getByRole("link", { name: /settings/i }).boundingBox())!;
    expect(Math.abs(home.y - settings.y)).toBeLessThan(4);
    expect(home.x).toBeLessThan(history.x);
    expect(history.x).toBeLessThan(settings.x);
    // Icon and label sit side by side, not stacked.
    expect(home.height).toBeLessThan(44);

    await expect(nav.getByRole("link", { name: /^v\d/ })).toHaveAttribute("href", "/changelog");
  });

  test("page content starts below the top bar", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/history");
    await expect(page.getByText("Sign in to view history.")).toBeVisible();

    const navBox = (await page.getByRole("navigation").boundingBox())!;
    const shellTop = await page.locator(".app-shell").evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(shellTop).toBeGreaterThanOrEqual(navBox.height);
  });

  test("on a phone the nav stays at the bottom without the app name", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/test-preview/bottom-nav");

    const nav = page.getByRole("navigation");
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y + navBox.height).toBeGreaterThan(PHONE.height - 2);
    await expect(nav.getByText("Workout Tracker")).toBeHidden();
  });
});

test.describe("flat sections", () => {
  test("a program card is a flat section with a top divider at desktop width", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/test-preview/program-card");

    const card = page.getByTestId("program-card");
    const style = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, top: s.borderTopWidth, left: s.borderLeftWidth, radius: s.borderTopLeftRadius };
    });
    expect(style.bg).toBe("rgba(0, 0, 0, 0)");
    expect(style.top).toBe("1px");
    expect(style.left).toBe("0px");
    expect(style.radius).toBe("0px");
  });

  test("a program card keeps its card look on a phone", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/test-preview/program-card");

    const bg = await page.getByTestId("program-card").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("home side column", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/test-preview/home-desktop");
  });

  test("Up today lists today's exercises and links to the program editor", async ({ page }) => {
    const upToday = page.getByRole("region", { name: "Up today" });
    await expect(upToday.getByText("Preview Program · Tuesday · Week 3")).toBeVisible();
    await expect(upToday.getByText("Bench Press")).toBeVisible();
    await expect(upToday.getByText("Main", { exact: true })).toBeVisible();
    await expect(upToday.getByText("Final set AMRAP")).toBeVisible();
    await expect(upToday.getByRole("link", { name: "Edit program →" })).toHaveAttribute("href", "/programs/preview-program");
  });

  test("Up today shows an exercise it can't resolve with the error, instead of hiding it", async ({ page }) => {
    const upToday = page.getByRole("region", { name: "Up today" });
    await expect(upToday.getByText("Unresolved exercise")).toBeVisible();
    await expect(upToday.getByText(/Exercise definition missing-def not found/)).toBeVisible();
  });

});

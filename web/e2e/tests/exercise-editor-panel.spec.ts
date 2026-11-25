// The program editor's exercise editor: on desktop a panel that slides in from the right, full
// height under the top bar (which stays usable); on a phone the existing bottom sheet.
import { expect, test } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function open(page: import("@playwright/test").Page) {
  await page.goto("/test-preview/exercise-editor");
  await page.locator("main[data-hydrated]").waitFor();
  return page.getByRole("dialog", { name: "Edit Exercise" });
}

test("on desktop the editor is a full-height panel on the right, below the top bar", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const panel = await open(page);
  await expect(panel).toBeVisible();
  // Let the slide-in finish before measuring.
  await page.waitForTimeout(400);
  const box = (await panel.boundingBox())!;
  const navBox = (await page.getByRole("navigation").boundingBox())!;
  expect(Math.round(box.x + box.width)).toBe(DESKTOP.width);
  expect(box.width).toBeLessThanOrEqual(520);
  expect(box.width).toBeGreaterThanOrEqual(400);
  expect(box.y).toBeGreaterThanOrEqual(navBox.y + navBox.height - 1);
  expect(Math.round(box.y + box.height)).toBe(DESKTOP.height);
  // The top bar isn't covered by the overlay.
  const onTop = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("nav"), [navBox.x + navBox.width / 2, navBox.y + navBox.height / 2]);
  expect(onTop).toBe(true);
});

test("on desktop Save and Cancel stay visible while the form scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  const panel = await open(page);
  await expect(panel.getByRole("button", { name: "Save" })).toBeInViewport();
  await expect(panel.getByRole("button", { name: "Cancel" })).toBeInViewport();
});

test("the close button closes the editor", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const panel = await open(page);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Editor closed")).toBeVisible();
  await expect(panel).toHaveCount(0);
});

test("on a phone the editor stays a bottom sheet", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const panel = await open(page);
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.width)).toBe(PHONE.width);
  expect(Math.round(box.y + box.height)).toBe(PHONE.height);
});

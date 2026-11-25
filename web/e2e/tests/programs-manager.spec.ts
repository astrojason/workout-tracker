// Desktop Programs page: managing programs (import, rename, current week, re-import, archive,
// delete) in place of the phone's Settings section. Every destructive action asks first.
import { expect, test } from "@playwright/test";

test.describe("programs manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/test-preview/programs-manager");
    await page.locator("main[data-hydrated]").waitFor();
  });

  const active = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Active programs" });
  const archived = (page: import("@playwright/test").Page) => page.getByRole("region", { name: /Archived/ });

  test("lists active programs with their week, days and activity, linking to the editor", async ({ page }) => {
    const row = active(page).getByRole("row", { name: /Block B/ });
    await expect(row.getByRole("link", { name: "Block B" })).toHaveAttribute("href", "/programs/p1");
    await expect(row.getByLabel("Current week of Block B")).toHaveValue("7");
    await expect(row).toContainText("Mon · Thu");
    await expect(row).toContainText("26");
    await expect(active(page).getByRole("row", { name: /Block A/ })).toHaveCount(0);
    await expect(archived(page)).toContainText("Archived · 1 program");
  });

  test("imports a spreadsheet, asking about exercises it doesn't know", async ({ page }) => {
    await page.getByLabel("Program spreadsheet").setInputFiles({ name: "Block C.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    const panel = page.getByRole("region", { name: "Import a program" });
    await expect(panel).toContainText("Block C.xlsx");
    await expect(panel.getByLabel("Program name")).toHaveValue("Block C");
    await panel.getByRole("button", { name: "Import Block C" }).click();
    await expect(panel.getByRole("button", { name: "Importing…" })).toBeDisabled();
    await expect(page.getByText("Cable Fly")).toBeVisible();
    await page.getByRole("button", { name: "Create new exercise" }).click();
    await expect(page.getByText('✓ Imported "Block C"')).toBeVisible();
    await expect(active(page).getByRole("row", { name: /Block C/ })).toBeVisible();
  });

  test("cancelling an import says nothing changed", async ({ page }) => {
    await page.getByLabel("Program spreadsheet").setInputFiles({ name: "Block C.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await page.getByRole("button", { name: "Import Block C" }).click();
    await page.getByRole("button", { name: "Cancel import" }).click();
    await expect(page.getByText("Import cancelled — nothing was changed.")).toBeVisible();
  });

  test("renames a program in place", async ({ page }) => {
    await active(page).getByRole("button", { name: "Rename Block B" }).click();
    await active(page).getByLabel("New name for Block B").fill("Block B2");
    await active(page).getByRole("button", { name: "Save" }).click();
    await expect(active(page).getByRole("link", { name: "Block B2" })).toBeVisible();
  });

  test("changes the current week with progress and success", async ({ page }) => {
    await active(page).getByLabel("Current week of Block B").selectOption("8");
    await expect(active(page).getByRole("row", { name: /Block B/ })).toContainText("Saving…");
    await expect(active(page).getByRole("row", { name: /Block B/ })).toContainText("✓ Saved");
    await expect(active(page).getByLabel("Current week of Block B")).toHaveValue("8");
  });

  test("archiving asks first and moves the program to Archived; unarchive brings it back", async ({ page }) => {
    await active(page).getByRole("button", { name: "Archive Block B…" }).click();
    await expect(page.getByRole("heading", { name: "Archive Block B" })).toBeVisible();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(active(page).getByRole("row", { name: /Block B/ })).toHaveCount(0);
    await archived(page).getByRole("button", { name: /Show/ }).click();
    await archived(page).getByRole("button", { name: "Unarchive Block B" }).click();
    await expect(active(page).getByRole("row", { name: /Block B/ })).toBeVisible();
  });

  test("a failed action shows the error", async ({ page }) => {
    await active(page).getByRole("button", { name: "Archive Mobility…" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("Preview: archiving failed")).toBeVisible();
  });

  test("deleting asks first and shows progress", async ({ page }) => {
    await active(page).getByRole("button", { name: "Delete Block B…" }).click();
    await expect(page.getByRole("heading", { name: "Delete Block B" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Deleting..." })).toBeVisible();
    await expect(active(page).getByRole("row", { name: /Block B/ })).toHaveCount(0);
  });

  test("re-importing asks first, then takes the new file", async ({ page }) => {
    await active(page).getByRole("button", { name: "Re-import Block B…" }).click();
    await expect(page.getByRole("heading", { name: "Re-import Block B" })).toBeVisible();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose file" }).click();
    await (await chooser).setFiles({ name: "Block B v2.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await expect(page.getByText('✓ Re-imported "Block B"')).toBeVisible();
  });
});

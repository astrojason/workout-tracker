import { expect, test } from "@playwright/test";

test("add, validate, edit and delete gym machines", async ({ page }) => {
  await page.goto("/test-preview/gym-machines");

  // Seeded: Chest Press, used by 2 exercises.
  await expect(page.getByText("Chest Press")).toBeVisible();
  await expect(page.getByText("2 exercises")).toBeVisible();

  // Validation: needs two weights, and names must be unique (case-insensitive).
  await page.getByLabel("Machine name").fill("Lat Pulldown");
  await page.getByLabel("Machine weights").fill("10");
  await page.getByRole("button", { name: "Add machine" }).click();
  await expect(page.getByText(/at least two weights/)).toBeVisible();
  await page.getByLabel("Machine name").fill("chest press");
  await page.getByLabel("Machine weights").fill("10, 20");
  await page.getByRole("button", { name: "Add machine" }).click();
  await expect(page.getByText(/already exists/)).toBeVisible();

  // Add: weights are sorted and de-duplicated, and success is shown.
  await page.getByLabel("Machine name").fill("Lat Pulldown");
  await page.getByLabel("Machine weights").fill("42.5, 10, 20, 30, 20");
  await page.getByRole("button", { name: "Add machine" }).click();
  await expect(page.getByRole("status")).toContainText("Added “Lat Pulldown”");
  await expect(page.getByTestId("weights-Lat Pulldown")).toHaveText("10, 20, 30, 42.5");
  await expect(page.getByLabel("Machine name")).toHaveValue("");

  // Edit.
  await page.getByRole("button", { name: "Edit Lat Pulldown" }).click();
  await expect(page.getByLabel("Machine weights")).toHaveValue("10, 20, 30, 42.5");
  await page.getByLabel("Machine weights").fill("10, 20, 30, 40, 50");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved “Lat Pulldown”");
  await expect(page.getByTestId("weights-Lat Pulldown")).toHaveText("10, 20, 30, 40, 50");

  // Delete asks first, naming the machine and the exercises it will unlink.
  await page.getByRole("button", { name: "Delete Chest Press" }).click();
  await expect(page.getByText(/Delete “Chest Press”\?/)).toBeVisible();
  await expect(page.getByText(/2 exercises use it/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Chest Press")).toBeVisible();

  await page.getByRole("button", { name: "Delete Chest Press" }).click();
  await page.getByRole("button", { name: "Delete machine" }).click();
  await expect(page.getByRole("status")).toContainText("Deleted “Chest Press”");
  await expect(page.getByText("Chest Press", { exact: true })).toHaveCount(0);
});

test("shows an empty state and a spinner while loading", async ({ page }) => {
  await page.goto("/test-preview/gym-machines?empty=1&slow=1");
  await expect(page.getByText("Loading machines…")).toBeVisible();
  await expect(page.getByText("No gym machines yet")).toBeVisible();
});

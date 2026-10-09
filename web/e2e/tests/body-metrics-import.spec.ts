import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

function measurementsWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Measurement", "Baseline (Wk2 C3)", "Week 4"],
    ["RIGHT BICEP", '12 7/8"', '13"'],
    ["CHEST", '43 6/8"', '44"'],
    ["STOMACH", '47"', '46 4/8"'],
  ]), "Measurements");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

test("imports dated check-ins from a measurements spreadsheet", async ({ page }) => {
  await page.goto("/test-preview/body-metrics");

  await page.getByLabel("Measurements spreadsheet").setInputFiles({
    name: "plan.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: measurementsWorkbook(),
  });

  await expect(page.getByText("Import measurements")).toBeVisible();
  await page.getByLabel("Date for Baseline (Wk2 C3)").fill("2026-09-01");
  await page.getByLabel("Date for Week 4").fill("2026-09-29");
  await page.getByRole("button", { name: "Import 2 check-ins" }).click();

  await expect(page.getByText("46.5 in waist")).toBeVisible();
  await expect(page.getByText("13 in right bicep")).toBeVisible();
  await expect(page.getByText("Baseline measurements").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Body metrics trend chart" })).toBeVisible();
});

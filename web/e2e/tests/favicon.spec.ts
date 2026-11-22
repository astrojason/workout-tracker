// Safari and iOS ignore SVG favicons, so the site serves ICO, PNG and Apple touch icons.
import { expect, test } from "@playwright/test";

test("declares ICO, PNG and Apple touch icons and serves each", async ({ page, request }) => {
  await page.goto("/changelog");
  const hrefs = await page.locator("head link[rel~='icon'], head link[rel='apple-touch-icon']")
    .evaluateAll((links) => links.map((l) => ({ rel: l.getAttribute("rel"), href: l.getAttribute("href"), type: l.getAttribute("type") })));

  expect(hrefs.some((l) => l.href?.includes("favicon.ico"))).toBe(true);
  expect(hrefs.some((l) => l.href?.includes("icon.png") && l.type === "image/png")).toBe(true);
  const apple = hrefs.find((l) => l.rel === "apple-touch-icon");
  expect(apple?.href).toContain("apple-icon");

  for (const link of hrefs) {
    const response = await request.get(link.href!);
    expect(response.status(), link.href!).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
  }
});

test("serves /favicon.ico", async ({ request }) => {
  const response = await request.get("/favicon.ico");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);
});

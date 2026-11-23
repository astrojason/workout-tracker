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

// The artwork is a rounded square: the corners outside the curve must be transparent,
// otherwise browsers draw a white border around the icon.
test("favicon and PNG icon have transparent rounded corners (no white border)", async () => {
  const { readFileSync } = await import("fs");
  const { resolve } = await import("path");
  const sharp = (await import("sharp")).default;

  const png = readFileSync(resolve(__dirname, "../../src/app/icon.png"));
  const ico = readFileSync(resolve(__dirname, "../../src/app/favicon.ico"));
  // An ICO directory entry points at its image data; ours embeds PNG.
  const offset = ico.readUInt32LE(18);
  const icoPng = ico.subarray(offset);
  expect(icoPng.subarray(1, 4).toString()).toBe("PNG");

  for (const [name, buf] of [["icon.png", png], ["favicon.ico", icoPng]] as const) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(alphaAt(0, 0), `${name} top-left corner`).toBe(0);
    expect(alphaAt(info.width - 1, info.height - 1), `${name} bottom-right corner`).toBe(0);
    expect(alphaAt(info.width >> 1, info.height >> 1), `${name} centre`).toBe(255);
    // No near-white fringe on the outer edge midpoints either.
    const [r, g, b] = data.subarray((0 * info.width + (info.width >> 1)) * 4, (0 * info.width + (info.width >> 1)) * 4 + 3);
    expect(r + g + b, `${name} top edge is the brand colour, not white`).toBeLessThan(600);
  }
});

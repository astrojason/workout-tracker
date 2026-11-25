import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Playwright dev server builds into its own folder (see playwright.config.ts) so that
  // `npm run build`, which wipes and rewrites .next, can't pull files out from under it mid-run.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

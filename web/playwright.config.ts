import { defineConfig, devices } from "@playwright/test";

// The suite runs its own dev server, on its own port and build folder. Sharing .next with
// `npm run build` (or reusing a preview server on 3000 that shares it) breaks pages mid-run:
// the build deletes chunks the dev server is serving ("Cannot find module './1331.js'").
const E2E_PORT = 3100;
const E2E_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
    testDir: "./e2e/tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "html",

    use: {
        baseURL: E2E_URL,
        trace: "on-first-retry",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    // Start the Next.js dev server before tests run
    webServer: {
        command: `npx next dev --port ${E2E_PORT}`,
        url: E2E_URL,
        env: { NEXT_DIST_DIR: ".next-e2e" },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
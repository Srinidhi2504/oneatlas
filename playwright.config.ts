import { defineConfig, devices } from "@playwright/test";

// One smoke spec against a production build: `npm run build && npm run test:e2e`.
// Set E2E_BASE_URL to run it against a deployed URL instead (then no local server is started).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3300";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000, // first run after a build hits cold caches
  expect: { timeout: 15_000 }, // cold caches from a laptop far from the DB region can take several seconds per page
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run start -- --port 3300", url: `${baseURL}/api/v1/health`, reuseExistingServer: true, timeout: 120_000 },
});

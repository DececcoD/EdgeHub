import { defineConfig, devices } from "@playwright/test";

/**
 * The mock-mode demo user's data (bets/alerts/watchlist/bankroll) lives in
 * a single in-process Map, shared by every request the dev server handles.
 * Running specs in parallel would let them race on that shared state, so
 * this suite runs fully serially - one worker, no parallel test files.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Always a production server, never `next dev`: dev mode's HMR/React
  // Refresh legitimately needs `eval()`, which the app's CSP (script-src
  // 'self' 'unsafe-inline', deliberately no 'unsafe-eval' - see
  // middleware.ts) blocks and logs as a console error on every route,
  // which the smoke spec would otherwise misreport as a real bug.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 180_000
  }
});

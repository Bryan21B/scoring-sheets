import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

/**
 * E2E runs against a real production build, not the dev server: dev-only
 * behaviour (no minification, different caching, React strict double-render)
 * hides the failures this suite exists to catch.
 *
 * Not part of `bun run test` on purpose — see AGENTS.md, "Testing".
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Migrate then serve, against a throwaway database so a local run never
    // touches ./data/app.db.
    command: `bun scripts/migrate.mjs && bun run start --port ${port}`,
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      DATABASE_PATH: "./data/e2e.db",
      LOG_LEVEL: "warn",
    },
  },
});

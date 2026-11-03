import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_URL || "http://127.0.0.1:55942";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)) throw new Error("E2E must use a local isolated environment");
export default defineConfig({
  testDir: "./e2e", workers: 1, timeout: 45_000, retries: process.env.CI ? 1 : 0,
  outputDir: ".context/e2e-results", reporter: "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", viewport: { width: 1440, height: 900 } },
  webServer: process.env.E2E_URL ? undefined : [{
    command: "npm run dev", url: `${baseURL}/api/ready`, timeout: 60_000,
    env: { ...process.env, PORT: String(new URL(baseURL).port), DATABASE_URL: process.env.E2E_DATABASE_URL || "postgres://mind_test:mind_test@127.0.0.1:5432/mind_e2e",
      RUN_STARTUP_MIGRATIONS: "false", RUN_BACKGROUND_JOBS: "false", FINANCIAL_PRIVATE_STORAGE_DIR: ".context/e2e-private", SESSION_SECRET: "isolated-e2e-test-only" },
  }, {
    command: "npm run dev", url: "http://127.0.0.1:55943/api/ready", timeout: 60_000,
    env: { ...process.env, PORT: "55943", API_ONLY: "true", DATABASE_URL: process.env.E2E_DATABASE_URL || "postgres://mind_test:mind_test@127.0.0.1:5432/mind_e2e",
      RUN_STARTUP_MIGRATIONS: "false", RUN_BACKGROUND_JOBS: "false", FINANCIAL_PRIVATE_STORAGE_DIR: ".context/e2e-private", SESSION_SECRET: "isolated-e2e-test-only" },
  }],
});

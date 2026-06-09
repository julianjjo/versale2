import { defineConfig, devices } from "@playwright/test";
import path from "path";

const REPO_ROOT = __dirname;
const API_DIR = path.join(REPO_ROOT, "apps", "api");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");

const E2E_DB = path.join(API_DIR, "e2e.db");
const API_PORT = 3101;
const WEB_PORT = 3100;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: path.join(REPO_ROOT, "e2e", "utils", "global-setup.ts"),
  webServer: [
    {
      command: `rm -f tsconfig.build.tsbuildinfo && DATABASE_URL=file:${E2E_DB} npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss && DATABASE_URL=file:${E2E_DB} PORT=${API_PORT} JWT_SECRET=e2e-test-secret NODE_ENV=test npx nest start`,
      cwd: API_DIR,
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: `file:${E2E_DB}`,
        PORT: String(API_PORT),
        JWT_SECRET: "e2e-test-secret",
        NODE_ENV: "test",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `NEXT_PUBLIC_API_URL=${API_URL} NODE_ENV=test npx next dev -p ${WEB_PORT}`,
      cwd: WEB_DIR,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NODE_ENV: "test",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
  outputDir: "playwright-report",
  expect: {
    timeout: 5_000,
  },
});

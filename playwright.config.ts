import { defineConfig, devices } from "@playwright/test";
import path from "path";

const REPO_ROOT = __dirname;
const API_DIR = path.join(REPO_ROOT, "apps", "api");
const WEB_DIR = path.join(REPO_ROOT, "apps", "web");

const E2E_DB = path.join(API_DIR, "e2e.db");
const RESET_DB_SCRIPT = path.join(REPO_ROOT, "e2e", "utils", "reset-db.js");
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
  // On CI the run also emits JUnit XML so Codecov Test Analytics can ingest
  // it (see the upload step in .github/workflows/ci.yml). It is written to
  // test-results/ rather than into `outputDir` below, because Playwright
  // clears `outputDir` at the start of every run. test-results/ is gitignored.
  reporter: process.env.CI
    ? [["github"], ["junit", { outputFile: "test-results/junit.xml" }]]
    : "list",
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
      // Rebuild the e2e database from the committed migrations, not from
      // `prisma db push`. A push silently reconciles the DB with schema.prisma,
      // which is exactly how the schema once drifted ahead of the migrations
      // without anything failing. Deploying migrations makes the suite fail
      // loudly if a schema change ever ships without one again.
      //
      // Every variable this needs comes from `env` below rather than inline
      // `VAR=value` prefixes, which are POSIX-only and broke the suite on
      // Windows.
      //
      // The script path is quoted: Playwright runs webServer commands through a
      // shell, so an unquoted absolute path word-splits on the first space and
      // `node C:\Users\First` kills the whole `&&` chain before Nest ever starts
      // — on exactly the Windows checkouts this command was rewritten to serve.
      command: `node "${RESET_DB_SCRIPT}" && npx prisma migrate deploy --schema=./prisma/schema.prisma && npx nest start`,
      cwd: API_DIR,
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: `file:${E2E_DB}`,
        PORT: String(API_PORT),
        JWT_SECRET: "e2e-test-secret",
        NODE_ENV: "test",
        // The whole suite hits the API from one IP and logs in once per test,
        // so the production rate limits would throttle the run itself.
        THROTTLE_LIMIT: "100000",
        AUTH_THROTTLE_LIMIT: "100000",
        // GET /products (shopping.spec.ts, responsive.spec.ts, author-admin
        // .spec.ts, ...) is hit far more than PRODUCTS_SEARCH_THROTTLE_LIMIT's
        // production default (60/min) across the whole suite from this one IP.
        PRODUCTS_SEARCH_THROTTLE_LIMIT: "100000",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Same reason as the API server above: the env comes from `env`, not from
      // POSIX-only inline `VAR=value` prefixes.
      command: `npx next dev -p ${WEB_PORT}`,
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

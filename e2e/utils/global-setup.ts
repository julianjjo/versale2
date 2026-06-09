import { execSync } from "child_process";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const API_DIR = path.join(REPO_ROOT, "apps", "api");
const E2E_DB = path.join(API_DIR, "e2e.db");

function log(message: string) {
  console.log(`[e2e ${new Date().toISOString()}] ${message}`);
}

export default async function globalSetup() {
  log("Global setup starting");

  log("seeding database");
  execSync("npx tsx e2e/utils/seed.ts", {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${E2E_DB}`,
    },
    stdio: "inherit",
  });

  log("Global setup complete");
}

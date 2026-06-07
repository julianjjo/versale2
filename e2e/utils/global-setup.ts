import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const API_DIR = path.join(REPO_ROOT, "apps", "api");
const E2E_DB = path.join(API_DIR, "e2e.db");

export default async function globalSetup() {
  if (!fs.existsSync(E2E_DB)) {
    execSync(
      "npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss",
      {
        cwd: API_DIR,
        env: {
          ...process.env,
          DATABASE_URL: `file:${E2E_DB}`,
        },
        stdio: "inherit",
      },
    );
  }

  execSync("npx tsx e2e/utils/seed.ts", {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${E2E_DB}`,
    },
    stdio: "inherit",
  });

  console.log("[e2e] Global setup complete");
}

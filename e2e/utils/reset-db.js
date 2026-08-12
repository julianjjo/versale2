// Removes the artifacts that must not survive between e2e runs, before the API
// server starts: the stale incremental-build info and the SQLite file itself.
//
// This used to be `rm -f …` inline in playwright.config.ts, which only works on
// a POSIX shell — on Windows the whole webServer command failed before it ever
// started, so the suite could not be run locally there. Node's fs is portable.
const fs = require("fs");
const path = require("path");

const API_DIR = path.resolve(__dirname, "..", "..", "apps", "api");

const targets = [
  path.join(API_DIR, "tsconfig.build.tsbuildinfo"),
  path.join(API_DIR, "e2e.db"),
  // SQLite side-car files, present only if a run was interrupted mid-write.
  path.join(API_DIR, "e2e.db-journal"),
  path.join(API_DIR, "e2e.db-wal"),
  path.join(API_DIR, "e2e.db-shm"),
];

for (const target of targets) {
  fs.rmSync(target, { force: true });
}

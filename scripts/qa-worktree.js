#!/usr/bin/env node
// Cross-platform worktree helper — no bash, Windows quoting safe.
// Usage: node scripts/qa-worktree.js <slug> | node scripts/qa-worktree.js --remove <slug>
const { execSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}
function shOut(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

const portLocks = new Map();
const allocatedPorts = new Set();
async function withPortLock(port, fn) {
  const prev = portLocks.get(port) || Promise.resolve();
  const next = prev.then(() => fn());
  const silenced = next.catch(() => {});
  portLocks.set(port, silenced);
  try {
    return await next;
  } finally {
    if (portLocks.get(port) === silenced) portLocks.delete(port);
  }
}

async function freePort(start) {
  // per-port lock via in-process Map + allocated set; file lock if inter-process parallel creation becomes common
  for (let p = start; p < start + 200; p++) {
    const ok = await withPortLock(p, async () => {
      if (allocatedPorts.has(p)) return false;
      const free = await new Promise((res) => {
        const s = net.createServer();
        s.once("error", () => res(false));
        s.once("listening", () => s.close(() => res(true)));
        s.listen(p, "127.0.0.1");
      });
      if (free) allocatedPorts.add(p);
      return free;
    });
    if (ok) return p;
  }
  throw new Error("no free port from " + start);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("-h") || args.includes("--help")) {
    console.log("Usage: node scripts/qa-worktree.js <slug> | node scripts/qa-worktree.js --remove <slug>");
    process.exit(args.length ? 0 : 1);
  }
  if (args[0] === "--remove") {
    const slug = args[1];
    if (!slug) { console.error("slug required"); process.exit(1); }
    const wt = path.resolve(__dirname, "..", "..", `versale-qa-${slug}`);
    const branch = `qa/${slug}`;
    try { sh(`git worktree remove --force "${wt}"`); } catch {}
    try { fs.rmSync(wt, { recursive: true, force: true }); } catch {}
    try { sh(`git branch -D ${branch}`); } catch {}
    console.log(`removed ${wt} and ${branch}`);
    return;
  }
  const slug = args[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  if (!slug) { console.error("invalid slug"); process.exit(1); }
  const repoRoot = path.resolve(__dirname, "..");
  const wtPath = path.resolve(repoRoot, "..", `versale-qa-${slug}`);
  const branch = `qa/${slug}`;
  if (fs.existsSync(wtPath)) { console.error(`exists: ${wtPath}`); process.exit(1); }
  const apiPort = await freePort(3200);
  const webPort = await freePort(apiPort + 1);
  // create worktree from main
  sh(`git worktree add "${wtPath}" -b ${branch} main`);
  const e2eDb = path.join(wtPath, "apps", "api", `e2e-${slug}.db`);
  const meta = { slug, branch, wtPath, apiPort, webPort, e2eDb: `e2e-${slug}.db` };
  fs.writeFileSync(path.join(wtPath, ".qa-ports.json"), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
  console.log(`\nWorktree ready: ${wtPath} [${branch}]`);
  console.log(`  API  http://127.0.0.1:${apiPort}  (QA_API_PORT=${apiPort} QA_E2E_DB=${e2eDb})`);
  console.log(`  Web  http://127.0.0.1:${webPort}  (QA_WEB_PORT=${webPort})`);
  console.log(`Run:  QA_API_PORT=${apiPort} QA_WEB_PORT=${webPort} QA_E2E_DB=${e2eDb} npm run e2e`);
  console.log(`On Windows PowerShell: $env:QA_API_PORT=${apiPort}; $env:QA_WEB_PORT=${webPort}; $env:QA_E2E_DB="${e2eDb}"; npm run e2e`);
  console.log(`Remove: node scripts/qa-worktree.js --remove ${slug}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

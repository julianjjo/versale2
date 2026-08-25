# QA Autonomous Audit Loop — Design

## Goal
Minimal autonomous QA harness: isolated worktree per audit run + CDP runtime audit (console/network/performance) via Playwright, no new deps, Windows-safe.

## Architecture
```
developer --> node scripts/qa-worktree.js <slug>
                | git worktree add ../versale-qa-<slug> (branch qa/<slug>)
                | port probe from 3200+ -> writes .qa-ports.json
                | prints: QA_API_PORT / QA_WEB_PORT / QA_E2E_DB
                v
playwright.config.ts --reads--> QA_* env (fallback 3101/3100/e2e.db)
                | webServer[0] API: reset-db picks QA_E2E_DB, migrates, nest start on QA_API_PORT
                | webServer[1] Web: next dev -p QA_WEB_PORT with NEXT_PUBLIC_API_URL -> API
                | globalSetup: seed into QA_E2E_DB
                v
e2e/utils/cdp-audit.ts: attachCdpAudit(page) -- CDPSession + page.on(console/pageerror)
                v
e2e/tests/cdp-runtime-audit.spec.ts -- 3 tests (hydration/5xx/dup, BFS crawl 6 URLs, edge: double-click/offline/throttle)
```

## Components

### 1. Worktree harness (`scripts/qa-worktree.js` <100 lines)
- `node scripts/qa-worktree.js <slug>` -> `git worktree add ../versale-qa-<slug> -b qa/<slug>` from `main`.
- Port allocation: scan 3200..3299 via `net.createServer().listen(port)` probe; assign API=first free, WEB=second free. Persist `.qa-ports.json` in worktree. No bash, use `path.join`, `fs.rmSync`, `child_process.execSync` with quoted paths.
- `E2E_DB` override: `apps/api/e2e-<slug>.db` (isolated sqlite). `reset-db.js` already uses `DATABASE_URL` env; harness sets `QA_E2E_DB` which `playwright.config.ts` forwards as `DATABASE_URL`.
- `--remove <slug>` -> `git worktree remove --force ../versale-qa-<slug>` + `git branch -D qa/<slug>` (best-effort).
- `// ponytail: global probe lock, per-port lock if parallel creation matters` — sequential port scan is fine for rare manual runs.

### 2. CDP audit helper (`e2e/utils/cdp-audit.ts` ~60 lines)
- `attachCdpAudit(page)` returns `{ session, getResult(): AuditResult, detach() }`.
- Collects: `consoleErrors` (page.on console error + pageerror + Runtime.exceptionThrown + Log.entryAdded filtered to main world, `/hydrat/i` flagged separately), `failedRequests` (Network.responseReceived status>=400), `duplicateRequests` (url count>1 for /api), `metrics` (Performance.getMetrics), `longTasks` (best-effort via PerformanceObserver in page).
- `// ponytail: single CDPSession per page` — one `page.context().newCDPSession(page)` per attach.
- No `chrome-devtools-mcp`, no Puppeteer. Reuse Playwright CDP (already bundled). Playwright `page.on('console')` is primary; CDP supplements for hydration stacks.

### 3. Exploratory spec (`e2e/tests/cdp-runtime-audit.spec.ts`)
- `test.describe('cdp-audit', () => { test.describe.configure({ mode:'serial' }) })` tagged `@audit` via title; not in default shard bloat (capped ~6 URLs, serial to avoid port contention). Chromium-only (`test.skip(browserName !== 'chromium')`).
- T1: goto `/`, attach, `waitForLoadState(networkidle)`, assert no `/hydrat/i` errors, no status>=500, no duplicate `/api` fetches.
- T2: BFS crawl up to 6 routes: `/`, `/products`, `/products/[id]` (discover via first product link or seed), `/cart`, `/login`, `/signup`. For each: goto, snapshot interactives count via `page.accessibility.snapshot`, collect audit, soft assert no consoleErrors.
- T3: edge cases — (a) double-click `Agregar al carrito` debounced: `page.route('**/api/**', count)` + `dblclick` -> assert single request; (b) offline mid-flow: `context.setOffline(true)` -> graceful error banner (no unhandled exception); (c) throttled 3G/CPU via `Network.emulateNetworkConditions` + `Emulation.setCPUThrottlingRate` wrapped in try/catch (skip if unsupported).
- Cleanup `finally { await session.detach(); }`, `testInfo.attach('audit', {body: JSON.stringify(result)})`.

## Data Flow
Env `QA_API_PORT/QA_WEB_PORT/QA_E2E_DB` -> `playwright.config.ts` webServer env -> `reset-db.js` file rm -> `prisma migrate deploy` -> `nest start` (reads DATABASE_URL, PORT) -> Next dev (NEXT_PUBLIC_API_URL) -> Playwright tests -> CDP session -> AuditResult -> `testInfo.attach`.

## Testing Strategy
- No new unit tests (reuse existing `npm run test:api` / `test:web`). Verify: `npx tsc --noEmit` + `npx playwright test --list` (typecheck only, no boot). Optional full `npm run e2e -- cdp-runtime-audit`.
- Worktree script: manual `node scripts/qa-worktree.js foo && ls ../versale-qa-foo && node scripts/qa-worktree.js --remove foo`.
- Skipped: chrome-devtools-mcp server, custom MCP json, trace/HAR persistence, per-route perf budgets, OTel — add when audit proves flaky or slow; `skipped: chrome-devtools-mcp, add when Playwright CDP insufficient for Elements snapshot`.
- Skipped: file DB per test, add when parallel worktree contention measured.

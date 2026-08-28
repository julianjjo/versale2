# Ponytail Debt Ledger

> Generado via `grep -rnE '(#|//) ?ponytail:' apps e2e scripts` (excluye node_modules/.next/.git/.claude/.pi). Cada fila: `<file>:<line>, <what>. ceiling: <limit>. upgrade: <trigger>.` `no-trigger` = sin upgrade path explícito → riesgo de pudrirse.

## apps/api/src/products/products.service.ts
- `apps/api/src/products/products.service.ts:66`, cap MAX_TOP_RATED_SCAN=1000. ceiling: cap 1000. upgrade: materialize `averageRating`+index if catalog >1k sustained.
- `apps/api/src/products/products.service.ts:343`, O(n) in-memory top_rated sort per page. ceiling: O(n) cheap for n<10k (n=limit≤100 paginated, effective scan ≤1000). upgrade: materialize `averageRating` column + index if catalog >10k.

## apps/web/src/app/sell/page.tsx
- `apps/web/src/app/sell/page.tsx:77`, deleted BroadcastChannel dup. ceiling: storage+CustomEvent cover cross/same-tab. upgrade: restore `BroadcastChannel("versale-sell-draft")` if need instant cross-tab without storage round-trip.

## apps/web/src/components/products/products-browser.tsx
- `apps/web/src/components/products/products-browser.tsx:202`, 300ms live search. ceiling: 300ms debounced live search. upgrade: `no-trigger` — submit fallback already; tune debounce or add server search index if catalog >10k.

## apps/web/src/lib/token.ts
- `apps/web/src/lib/token.ts:4`, deleted BroadcastChannel dup. ceiling: storage+CustomEvent cover cross/same-tab. upgrade: restore `BroadcastChannel("versale-auth")` if need instant cross-tab without storage round-trip.

## e2e/tests/account-deletion.spec.ts
- `e2e/tests/account-deletion.spec.ts:8`, serial — backdate mutates shared e2e.db. ceiling: serial. upgrade: `no-trigger` — keep serial; add per-test DB isolation if parallel needed.
- `e2e/tests/account-deletion.spec.ts:32`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed via HTTP. upgrade: expose `POST /admin/debug/backdate` only in `NODE_ENV=test` if HTTP path needed.
- `e2e/tests/account-deletion.spec.ts:247`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed via HTTP. upgrade: same as above.

## e2e/tests/account-flows.spec.ts
- `e2e/tests/account-flows.spec.ts:8`, serial — backdate mutates shared e2e.db. ceiling: serial. upgrade: `no-trigger`.
- `e2e/tests/account-flows.spec.ts:21`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed. upgrade: expose debug endpoint if HTTP needed.
- `e2e/tests/account-flows.spec.ts:98`, resend no expone raw token — rotación probada vía invalidación del anterior. ceiling: no raw token in resend. upgrade: `no-trigger` — keep invalidación check; expose raw token only in test env if needed.
- `e2e/tests/account-flows.spec.ts:190`, bundled 3 UI flows in 1 serial test to avoid 2 extra signups — split if flaky. ceiling: bundled 3 flows. upgrade: split into 3 tests if flaky.

## e2e/tests/order-lifecycle.spec.ts
- `e2e/tests/order-lifecycle.spec.ts:83`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed. upgrade: expose `POST /orders/admin/debug/run-sweeps` only in `NODE_ENV=test` if needed.
- `e2e/tests/order-lifecycle.spec.ts:334`, cron no expuesto por HTTP — backdate directo a DB y verifica estado vía GET. ceiling: cron no expuesto. upgrade: same.
- `e2e/tests/order-lifecycle.spec.ts:385`, si hace falta testear autoRefund/autoResolve por HTTP, exponer POST /orders/admin/debug/run-sweeps solo en NODE_ENV=test. ceiling: no HTTP sweeps. upgrade: expose debug route if needed.

## e2e/tests/publish-moderation.spec.ts
- `e2e/tests/publish-moderation.spec.ts:75`, reason optional en DTO actual; si se vuelve required debe ser 400. ceiling: reason optional. upgrade: `no-trigger` — update expectation to 400 if DTO makes reason required.
- `e2e/tests/publish-moderation.spec.ts:164`, paused sigue contando (anti-bypass); liberar vía DELETE del más antiguo. ceiling: paused counts toward limit. upgrade: `no-trigger` — keep anti-bypass; change to exclude paused if product policy changes.

## e2e/utils/cdp-audit.ts
- `e2e/utils/cdp-audit.ts:39`, single CDPSession per page. ceiling: single CDPSession. upgrade: `no-trigger` — per-page session is fine; fan-out only if CDP contention observed.

---

18 markers, 8 with no trigger. (2026-08-28: scripts/qa-worktree.js per-port lock resolved; 2026-08-28: apps/api/src/cart per-key lock resolved; 2026-08-28: apps/web/src/app/products/[id]/__tests__/product-page.test.tsx grapheme-strict resolved — removed `ponytail: slice tolerante` marker, now Segmenter-strict; debts saldadas.)

> Ponytail ceiling for ledger itself: `// ponytail: ledger file, regenerate via grep if markers change; no watcher/cron until debt cadence >1/iteration` — regenerate with `npm run ponytail:debt` alias if cadence grows; until then manual iteration is YAGNI.

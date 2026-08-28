# Ponytail Debt Ledger

> Generado via `grep -rnE '(#|//) ?ponytail:' apps e2e scripts` (excluye node_modules/.next/.git/.claude/.pi). Cada fila: `<file>:<line>, <what>. ceiling: <limit>. upgrade: <trigger>.` `no-trigger` = sin upgrade path explícito → riesgo de pudrirse.

## apps/api/src/products/products.service.ts
- `apps/api/src/products/products.service.ts:66`, cap MAX_TOP_RATED_SCAN=1000, warn on truncation. ceiling: cap 1000, warned via logger.warn. upgrade: materialize `averageRating`+index if cap warn sustained (>1k).
- `apps/api/src/products/products.service.ts:343`, O(n) in-memory top_rated sort per page, warned. ceiling: O(n) cheap for n<10k, warned. upgrade: materialize `averageRating` column + index if catalog >10k.

## apps/web/src/app/sell/page.tsx
- `apps/web/src/app/sell/page.tsx:77`, deleted BroadcastChannel dup. ceiling: storage+CustomEvent cover cross/same-tab. upgrade: restore `BroadcastChannel("versale-sell-draft")` if need instant cross-tab without storage round-trip.

## apps/web/src/components/products/products-browser.tsx
- `apps/web/src/components/products/products-browser.tsx:202`, 300ms live search via useDebouncedSearch, submit fallback. ceiling: 300ms debounced live search. upgrade: server search index if catalog >10k.

## apps/web/src/lib/token.ts
- `apps/web/src/lib/token.ts:4`, deleted BroadcastChannel dup. ceiling: storage+CustomEvent cover cross/same-tab. upgrade: restore `BroadcastChannel("versale-auth")` if need instant cross-tab without storage round-trip.

## e2e/tests/account-deletion.spec.ts
- `e2e/tests/account-deletion.spec.ts:8`, serial — backdate mutates shared e2e.db; upgrade: per-test DB isolation or per-worker e2e.db if parallel needed. ceiling: serial. upgrade: per-test DB isolation or per-worker e2e.db if parallel needed.
- `e2e/tests/account-deletion.spec.ts:32`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed via HTTP. upgrade: expose `POST /admin/debug/backdate` only in `NODE_ENV=test` if HTTP path needed.
- `e2e/tests/account-deletion.spec.ts:247`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed via HTTP. upgrade: same as above.

## e2e/tests/account-flows.spec.ts
- `e2e/tests/account-flows.spec.ts:8`, serial — backdate mutates shared e2e.db; upgrade: per-test DB isolation or per-worker e2e.db if parallel needed. ceiling: serial. upgrade: per-test DB isolation or per-worker e2e.db if parallel needed.
- `e2e/tests/account-flows.spec.ts:21`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed. upgrade: expose debug endpoint if HTTP needed.
- `e2e/tests/account-flows.spec.ts:98`, resend no expone raw token — rotación probada vía invalidación del anterior. ceiling: no raw token in resend. upgrade: `no-trigger` — keep invalidación check; expose raw token only in test env if needed.

## e2e/tests/order-lifecycle.spec.ts
- `e2e/tests/order-lifecycle.spec.ts:83`, cron not exposed via HTTP — direct DB backdate is minimal e2e bridge. ceiling: cron not exposed, backdate bridge. upgrade: endpoint exists `POST /orders/admin/debug/run-sweeps` (test only, #400) — e2e can now trigger sweeps via HTTP if desired.
- `e2e/tests/order-lifecycle.spec.ts:334`, cron no expuesto por HTTP — backdate directo a DB y verifica estado vía GET. ceiling: cron no expuesto. upgrade: same endpoint exists.
- `e2e/tests/order-lifecycle.spec.ts:385`, si hace falta testear autoRefund/autoResolve por HTTP, exponer POST /orders/admin/debug/run-sweeps solo en NODE_ENV=test. ceiling: no HTTP sweeps. upgrade: endpoint exists `POST /orders/admin/debug/run-sweeps` (test only, implemented 2026-08-28).

## e2e/tests/publish-moderation.spec.ts
- `e2e/tests/publish-moderation.spec.ts:164`, paused sigue contando (anti-bypass); liberar vía DELETE del más antiguo. ceiling: paused counts toward limit. upgrade: `no-trigger` — keep anti-bypass; change to exclude paused if product policy changes.

## e2e/utils/cdp-audit.ts
- `e2e/utils/cdp-audit.ts:39`, single CDPSession per page; upgrade: per-page session is fine; fan-out or per-context session if CDP contention observed. ceiling: single CDPSession. upgrade: fan-out or per-context session if CDP contention observed.

---

16 markers, 3 with no trigger. (2026-08-28: scripts/qa-worktree.js per-port lock; 2026-08-28: apps/api/src/cart per-key lock; 2026-08-28: product-page grapheme-strict; 2026-08-28: products-browser debounce; 2026-08-28: products top_rated cap warned; 2026-08-28: orders debug sweeps endpoint; 2026-08-28: account-flows bundled UI split; 2026-08-28: cdp-audit upgrade; 2026-08-28: publish-moderation reject reason required; 2026-08-28: account-deletion serial upgrade; 2026-08-28: account-flows serial upgrade explicit — no-trigger 4→3; debts saldadas/progress.)

> Ponytail ceiling for ledger itself: `// ponytail: ledger file, regenerate via grep if markers change; no watcher/cron until debt cadence >1/iteration` — regenerate with `npm run ponytail:debt` alias if cadence grows; until then manual iteration is YAGNI.

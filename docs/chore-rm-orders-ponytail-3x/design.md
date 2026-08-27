# chore: rm orders 3x-loop ponytail debt (sweepOrders)

## Architecture

- `apps/api/src/orders/orders.service.ts:1016` `// ponytail: 3× loop dedup into helper, split into per-status sweepers if drift needs isolation`
- Helper `private sweepOrders(opts:{where,toStatus,notification,warnPrefix})` already dedups 3 sweeps:
  - `autoRefundUnshippedPaidOrders` (PAID→REFUNDED, 7d)
  - `autoResolveExpiredDisputes` (DISPUTED→REFUNDED, 30d)
  - `autoCancelStalePendingOrders` (PENDING→CANCELLED, 24h)
- Each calls `sweepOrders` with distinct `where/toStatus/notification` and cursor pagination (500/batch).
- No per-status helper drift observed in 202 QA cycles (100% gates). Split would add 3× boilerplate for no isolation benefit now; YAGNI.

## Data flow

- Unchanged. `sweepOrders` → `findMany(where, take 500, cursor)` → `transitionStatus` → `notifySafely` → return total.

## Components

- Single file: `orders.service.ts` line 1016 comment removal only. No behavior change.

## Testing strategy

- `npm run test:api` (47 suites, 729-730 tests) still green: sweep pagination test validates `take:500`/`cursor`/`total 510`.
- `npm run lint:ci` 0 errors, 0 warnings (web 0/0).
- Verify `grep -rn ponytail apps/api/src/orders` → 0 after removal.

## Risks

- None. Comment-only deletion; no runtime change. If drift later needed, reintroduce per-status helpers.

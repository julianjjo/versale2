# refactor(web): remove explanatory comments from order-status (ponytail ultra, -11L)

## Summary
Deletes pure explanatory comment blocks (11L) in `apps/web/src/lib/order-status.ts`. Zero logic. Blocks:
- L10 `// Item 12.` (1L, inside ORDER_STATUSES)
- L25-29 `// Mirrors ALLOWED_STATUS_TRANSITIONS...` authority/lifecycle rationale (5L)
- L32 `// REFUNDED desde PAID es el timeout de 7 días sin envío (cron).` (1L)
- L35-36 `// Item 12: la entrega puede entrar en disputa...` (2L)
- L43 `/** Statuses an order in \`status\` can legally move to. Empty for terminal states. */` (1L)
- L48 `/** Statuses every one of \`statuses\` can legally move to — for bulk actions. */` (1L)
Net 76→65L, `git diff --stat` 1 file, 11 deletions(-). Behavior preserved.

## Changes
- `apps/web/src/lib/order-status.ts`: delete 6 comment blocks (11L). Logic untouched: `ORDER_STATUSES` 7-status array, `ORDER_STATUS_LABEL` Spanish labels `Pendiente/Pagado/Enviado/Entregado/Cancelado/En disputa/Reembolsado`, `ALLOWED_STATUS_TRANSITIONS` finite-state table (`PENDING→PAID/CANCELLED`, `PAID→SHIPPED/CANCELLED/REFUNDED`, `SHIPPED→DELIVERED`, `DELIVERED→DISPUTED`, `DISPUTED→REFUNDED/DELIVERED`, `CANCELLED/REFUNDED→[]`), `nextStatusesFor`/`commonNextStatuses` helpers (`?? []` + `map/reduce` intersection), `ORDER_STATUS_VARIANT`, `ORDER_STATUS_REASSURANCE`.

## Why (ponytail ultra, rung 1 YAGNI)
Pure comments. Ladder check: explanatory text recreates history — code already self-describing (`ALLOWED_STATUS_TRANSITIONS` table defines lifecycle, API is authority rejecting 400, table is display mirror). Delete outright. No `ponytail:` ceiling — git history retains rationale; re-add only if confusion reported. Previous ponytails (-11L timeline, -11L FORM_FIELDS, -15L upload guard) same rung.

## Verification
- `git diff --stat` 1 file, 11 deletions(-), 65L post-edit
- `grep -F "Mirrors ALLOWED" apps/web/src/lib/order-status.ts` 0 hits
- `grep -F "REFUNDED desde PAID" apps/web/src/lib/order-status.ts` 0 hits
- `grep -F "Item 12" apps/web/src/lib/order-status.ts` 0 hits
- `grep -F "Statuses an order" apps/web/src/lib/order-status.ts` 0 hits
- `grep -F "Statuses every one" apps/web/src/lib/order-status.ts` 0 hits
- `grep -R "ORDER_STATUSES" apps/web --include="*.ts" --include="*.tsx"` consumers `orders/mis-ventas/admin-orders` unchanged
- `npm run test:web` 43 suites ~545 pass, `npm run test:api` 47 suites 714 pass (100% green before PR)
- Spanish UI preserved (`ORDER_STATUS_LABEL`, `ORDER_STATUS_REASSURANCE`, `Pendiente`…`Reembolsado`)

## Risk
None — comments inert. No runtime, no export, no type import. `ALLOWED_STATUS_TRANSITIONS` + helpers + labels/variants/reassurance unchanged. Consumers `orders`/`mis-ventas`/`admin-orders` invariant.

## Diff stat
`apps/web/src/lib/order-status.ts | 11 deletions(-)`

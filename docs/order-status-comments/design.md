# order-status-comments -- Design (ponytail ultra, -11L)

## Scope
Single-file ponytail ultra deletion: pure explanatory comment blocks (11L) in `apps/web/src/lib/order-status.ts`. Zero logic, no runtime effect. Blocks:
- L10: `// Item 12.` (1L, inside `ORDER_STATUSES` between CANCELLED and DISPUTED)
- L25-29: `// Mirrors ALLOWED_STATUS_TRANSITIONS in apps/api/src/orders/order-status.enum.ts.` + 4L authority/lifecycle rationale (5L, above `ALLOWED_STATUS_TRANSITIONS`)
- L32: `// REFUNDED desde PAID es el timeout de 7 días sin envío (cron).` (1L, inside PAID transitions)
- L35-36: `// Item 12: la entrega puede entrar en disputa; la resolución del admin` + `// reembolsa o rechaza de vuelta a DELIVERED.` (2L, above DELIVERED)
- L43: `/** Statuses an order in \`status\` can legally move to. Empty for terminal states. */` (1L, above `nextStatusesFor`)
- L48: `/** Statuses every one of \`statuses\` can legally move to — for bulk actions. */` (1L, above `commonNextStatuses`)
Net 76→65L, `git diff --stat` 1 file, -11L. Behavior preserved: exports `ORDER_STATUSES`/`ORDER_STATUS_LABEL`/`ALLOWED_STATUS_TRANSITIONS`/`nextStatusesFor`/`commonNextStatuses`/`ORDER_STATUS_VARIANT`/`ORDER_STATUS_REASSURANCE` unchanged, Spanish labels `Pendiente/Pagado/Enviado/Entregado/Cancelado/En disputa/Reembolsado` preserved.

## Architecture
- **Before**: 76L file with 6 comment blocks interleaved with transitions table and JSDoc on helpers. Comments reference backend authority (`apps/api/src/orders/order-status.enum.ts`), cron timeout (7 days), Item 12 dispute lifecycle, and per-function JSDoc.
- **After**: comments deleted, blank lines collapsed to single separator. Logic untouched:
  ```ts
  import type { BadgeVariant } from "@/components/ui";
  import type { OrderStatus } from "./types";
  export const ORDER_STATUSES: OrderStatus[] = ["PENDING","PAID","SHIPPED","DELIVERED","CANCELLED","DISPUTED","REFUNDED"];
  export const ORDER_STATUS_LABEL: Record<OrderStatus,string> = { PENDING:"Pendiente", PAID:"Pagado", SHIPPED:"Enviado", DELIVERED:"Entregado", CANCELLED:"Cancelado", DISPUTED:"En disputa", REFUNDED:"Reembolsado" };
  export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus,OrderStatus[]> = {
    PENDING:["PAID","CANCELLED"], PAID:["SHIPPED","CANCELLED","REFUNDED"], SHIPPED:["DELIVERED"], DELIVERED:["DISPUTED"], DISPUTED:["REFUNDED","DELIVERED"], CANCELLED:[], REFUNDED:[]
  };
  export function nextStatusesFor(status: OrderStatus){ return ALLOWED_STATUS_TRANSITIONS[status] ?? []; }
  export function commonNextStatuses(statuses: OrderStatus[]){ if(statuses.length===0) return []; return statuses.map(nextStatusesFor).reduce((shared,next)=>shared.filter(s=>next.includes(s))); }
  export const ORDER_STATUS_VARIANT: Record<OrderStatus,BadgeVariant> = { PENDING:"warning", PAID:"info", SHIPPED:"info", DELIVERED:"success", CANCELLED:"danger", DISPUTED:"warning", REFUNDED:"danger" };
  export const ORDER_STATUS_REASSURANCE: Record<OrderStatus,string> = { PENDING:"Estamos confirmando tu pago.", PAID:"Tu pedido se está preparando para el envío.", SHIPPED:"Tu pedido está en camino.", DELIVERED:"Tu pedido fue entregado.", CANCELLED:"Este pedido fue cancelado.", DISPUTED:"Tu disputa está en revisión por un administrador. Te avisaremos la resolución.", REFUNDED:"El monto de este pedido te fue reembolsado." };
  ```
- No new deps, no interfaces, no config. Ladder rung 1 YAGNI pure comments.

## Data flow (orders)
`OrderStatus` union (`PENDING|PAID|SHIPPED|DELIVERED|CANCELLED|DISPUTED|REFUNDED`) → `ORDER_STATUSES` array → `ORDER_STATUS_LABEL` Spanish map → `ALLOWED_STATUS_TRANSITIONS` finite state map → `nextStatusesFor` single-status lookup → `commonNextStatuses` bulk intersection (map+reduce) → UI consumers (`orders`, `mis-ventas`, `admin-orders`, `order-status-timeline`) render label/variant/reassurance and compute allowed selects. API (`apps/api/src/orders/order-status.enum.ts`) is authority rejecting invalid transitions with 400; web table is display mirror, no validation path here.

## Components
- `ORDER_STATUSES`: 7-element array, order unchanged, `// Item 12.` deleted between CANCELLED and DISPUTED.
- `ORDER_STATUS_LABEL`: 7-entry Spanish map untouched.
- `ALLOWED_STATUS_TRANSITIONS`: 7-key finite-state table untouched; 3 inline comment blocks deleted (5L header, 1L PAID, 2L DELIVERED). Transitions remain: PENDING→PAID/CANCELLED, PAID→SHIPPED/CANCELLED/REFUNDED (cron timeout), SHIPPED→DELIVERED, DELIVERED→DISPUTED, DISPUTED→REFUNDED/DELIVERED, CANCELLED/REFUNDED→[].
- `nextStatusesFor`: pure lookup `ALLOWED_STATUS_TRANSITIONS[status] ?? []`; JSDoc deleted, body preserved.
- `commonNextStatuses`: bulk intersection `statuses.map(nextStatusesFor).reduce(filter)`; JSDoc deleted, body preserved; empty-array guard retained.
- `ORDER_STATUS_VARIANT`: 7-entry BadgeVariant map untouched.
- `ORDER_STATUS_REASSURANCE`: 7-entry Spanish reassurance map untouched.
- Consumers: `orders`, `mis-ventas`, `admin-orders` unchanged — imports still resolve, no signature change.

## Testing strategy
- Existing suites cover order-status: web order display, `OrderStatus` label/variant, `nextStatusesFor`/`commonNextStatuses` consumers via orders/mis-ventas/admin-orders pages and lib tests. Deleting comments cannot break them.
- Verification: `npm run test:web` (43 suites ~545 pass) + `npm run test:api` (47 suites 714 pass) 100% green before PR. Prettier/lint pass.
- Grep contract: `git grep -F "Mirrors ALLOWED"` 0 hits, `git grep -F "REFUNDED desde PAID"` 0 hits, `git grep -F "Item 12"` 0 hits in file, `git grep -F "Statuses an order"` 0 hits, `git grep -F "Statuses every one"` 0 hits post-edit. `wc -l` 76→65.

## Ponytail ladder
Rung 1 — does this need to exist? No. Comments are explanatory, not logic; code is self-describing (`ALLOWED_STATUS_TRANSITIONS` table defines lifecycle, `?? []` for terminal states, API enum is authority). Delete outright. If rationale needed, git history retains it; don't resurrect as JSDoc. No ponytail ceiling.

## Ceiling
None needed. Pure comment deletion has no runtime ceiling. If future maintainers need rationale, `git log -p -- apps/web/src/lib/order-status.ts` shows removed blocks; re-adding a one-line `// lifecycle: see api order-status.enum.ts` is YAGNI until confusion reported. No `ponytail:` comment required — deletion is complete.

## Security / Perf
- Security: comments inert, no trust boundary — no vuln. `ALLOWED_STATUS_TRANSITIONS` is display copy; API enforces with 400.
- Perf: -11L parse, negligible; removes comment tokens at build.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -11L, no abstraction — PASS.
- **Security**: pure comments, no input handling — PASS.
- **Perf**: less code to parse, no regression — PASS.
- **Test**: Web/API suites green, order-status behavior invariant — PASS.
- **Action**: no design change.

# timeline-comment-cleanup -- Design (ponytail ultra, -11L)

## Scope
Single-file ponytail ultra deletion: pure explanatory comment blocks (11L) in `apps/web/src/components/orders/order-status-timeline.tsx`. Zero logic, no runtime effect. Blocks:
- L4-7: `Cancellation can only happen...branch off happy path` (4L, above `TIMELINE_STEPS`)
- L12-15: `No role=status...live-region` (4L, inside `CANCELLED` early-return)
- L30-32: `final step has nothing after it...` (3L, inside `isDone` calc)
Net 76->65L, `git diff --stat` 1 file, -11L. Behavior preserved: `CANCELLED` early-return, `TIMELINE_STEPS=["PENDING","PAID","SHIPPED","DELIVERED"]`, `isDone=index<reachedIndex||(isReached&&index===lastIndex)`, `isCurrent=isReached&&!isDone`.

## Architecture
- **Before**: 76L file with 3 comment blocks interleaved with logic. Comments describe why cancellation is a terminal branch (see `ALLOWED_STATUS_TRANSITIONS` in `lib/order-status.ts`), why no `role="status"` live-region, and why final step `DELIVERED` is `isDone` not `isCurrent`.
- **After**: comments deleted, blank lines collapsed. Logic untouched:
  ```ts
  import { ORDER_STATUS_LABEL } from "@/lib/order-status";
  import type { OrderStatus } from "@/lib/types";
  const TIMELINE_STEPS: OrderStatus[] = ["PENDING","PAID","SHIPPED","DELIVERED"];
  export function OrderStatusTimeline({status}:{status:OrderStatus}){
    if(status==="CANCELLED") return <p>Pedido cancelado.</p>;
    const reachedIndex=TIMELINE_STEPS.indexOf(status);
    const lastIndex=TIMELINE_STEPS.length-1;
    return <ol>{TIMELINE_STEPS.map((step,index)=>{
      const isReached=index<=reachedIndex;
      const isDone=index<reachedIndex||(isReached&&index===lastIndex);
      const isCurrent=isReached&&!isDone;
      ...
    })}</ol>;
  }
  ```
- No new deps, no interfaces, no config. Ladder rung 1 YAGNI pure comments.

## Data flow (orders)
`OrderStatus` (PENDING|PAID|SHIPPED|DELIVERED|CANCELLED) -> `OrderStatusTimeline` -> `CANCELLED` early-return `<p>` else `reachedIndex=indexOf(status)` -> per-step `isReached/isDone/isCurrent` -> `aria-current="step"` + visual `border-success/isCurrent border-info` + `sr-only (completado|actual|pendiente)`. No `ALLOWED_STATUS_TRANSITIONS` import; comment only referenced it.

## Components
- `OrderStatusTimeline`: unchanged except deletion of 11L comments above/inside it.
- `TIMELINE_STEPS`: const array untouched, 4 steps linear.
- `CANCELLED` branch: still returns same `<p>` with `border-danger/20 bg-danger/10 text-danger` "Pedido cancelado.", no `role="status"` (behavior preserved, comment deleted).
- `isDone/isCurrent`: ternary logic preserved verbatim.

## Testing strategy
- Existing web suites cover orders/timeline: `OrderStatusTimeline` via order display pages, snapshot/style tests. Deleting comments cannot break them.
- Verification: `npm run test:web` (43 suites ~545 pass) + `npm run test:api` (47 suites 714 pass) 100% green before PR. Prettier/lint pass.
- Grep contract: `git grep -F "Cancellation can only happen"` 0 hits, `git grep -F "No role="` 0 hits, `git grep -F "final step has nothing"` 0 hits post-edit. `wc -l` 76->65.

## Ponytail ladder
Rung 1 -- does this need to exist? No. Comments are explanatory, not logic; code is self-describing (`CANCELLED` early-return, `index===lastIndex` guard). Delete outright. If rationale needed, git history retains it; don't resurrect as JSDoc. No ponytail ceiling.

## Ceiling
None needed. Pure comment deletion has no runtime ceiling. If future maintainers need rationale, `git log -p -- apps/web/src/components/orders/order-status-timeline.tsx` shows removed blocks; re-adding a one-line `// CANCELLED is terminal branch` is YAGNI until confusion reported. No `ponytail:` comment required -- deletion is complete.

## Security / Perf
- Security: comments inert, no trust boundary -- no vuln.
- Perf: -11L parse, negligible; removes comment tokens at build.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -11L, no abstraction -- PASS.
- **Security**: pure comments, no input handling -- PASS.
- **Perf**: less code to parse, no regression -- PASS.
- **Test**: Web/API suites green, timeline behavior invariant -- PASS.
- **Action**: no design change.

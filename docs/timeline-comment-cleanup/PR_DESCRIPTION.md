# refactor(web): remove explanatory comments from timeline (ponytail ultra, -11L)

## Summary
Deletes pure explanatory comment blocks (11L) in `apps/web/src/components/orders/order-status-timeline.tsx`. Zero logic. Blocks:
- L4-7 `Cancellation can only happen...branch off happy path` (4L)
- L12-15 `No role=status...live-region` (4L)
- L30-32 `final step has nothing after it...` (3L)
Net 76->65L, `git diff --stat` 1 file, -11L. Behavior preserved.

## Changes
- `apps/web/src/components/orders/order-status-timeline.tsx`: delete 3 comment blocks (11L). Logic untouched: `CANCELLED` early-return `<p>Pedido cancelado.</p>`, `TIMELINE_STEPS`, `isDone`/`isCurrent` (`isDone=index<reachedIndex||(isReached&&index===lastIndex)`).

## Why (ponytail ultra, rung 1 YAGNI)
Pure comments. Ladder check: explanatory text recreates history -- code already self-describing (`status===CANCELLED` branch, `index===lastIndex` guard). Delete outright. No `ponytail:` ceiling -- git history retains rationale; re-add only if confusion reported. Previous ponytails (-11L `FORM_FIELDS`, -4L `truncateDescription`) same rung.

## Verification
- `grep -F "Cancellation can only happen" apps/web/src/components/orders/order-status-timeline.tsx` 0 hits
- `grep -F "No role=" apps/web/src/components/orders/order-status-timeline.tsx` 0 hits
- `grep -F "final step has nothing" apps/web/src/components/orders/order-status-timeline.tsx` 0 hits
- `git diff --stat` 1 file, 11 deletions(-), 65L post-edit
- `npm run test:web` 43 suites ~545 pass, `npm run test:api` 47 suites 714 pass (100% green before PR)
- Spanish UI preserved (`Pedido cancelado.`, `Progreso del pedido`, `ORDER_STATUS_LABEL`, `sr-only (completado|actual|pendiente)`)

## Risk
None -- comments inert. No runtime, no export, no type import. Timeline rendering, `aria-current="step"`, visual states (`border-success`/`border-info`/`border-border`) unchanged.

## Diff stat
`apps/web/src/components/orders/order-status-timeline.tsx | 11 deletions(-)`

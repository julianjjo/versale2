# refactor(web): inline CheckIcon SVG, delete single-use function (ponytail ultra, -10L)

## Summary
Ponytail ultra deletion: `apps/web/src/components/orders/order-status-timeline.tsx` — inline single-use `CheckIcon` SVG where used and delete private function. Net -10L, 1 file, no behavior change, Spanish labels untouched.

## Scope
- **1 file**: `apps/web/src/components/orders/order-status-timeline.tsx`
- **Delete** `function CheckIcon()` (L78-94, 17L) — private, single impl, single call site.
- **Inline** at L52: `{isDone ? <CheckIcon /> : index + 1}` → `{isDone ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> : index + 1}`

## Architecture — before / after

**Before (94L)**:
```tsx
{isDone ? <CheckIcon /> : index + 1}
...
function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
```

**After (84L, -10L)**:
```tsx
{isDone ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> : index + 1}
```
No `CheckIcon` symbol; `git diff --stat` = `1 file changed, 1 insertion(+), 11 deletions(-)` (≈ -10L).

## Data flow
`Order detail page` → `<OrderStatusTimeline status />` → `TIMELINE_STEPS.indexOf(status)` → `isReached` → `isDone` (completed) / `isCurrent` → badge span `aria-hidden` renders inline SVG or step number → connector + label + `sr-only` `(completado)/(actual)/(pendiente)` + `aria-current="step"`; `CANCELLED` early return `<p>Pedido cancelado.</p>` unchanged.

## Ponytail ladder
- **Rung 1 — YAGNI**: no single-impl function; single call site does not justify component indirection. Deletion before addition, boring over clever, fewest files.

## Ceiling
Inline until reuse: extract to `src/components/ui/icons.tsx` (or shared icons) if SVG reused in ≥2 places or diverges by size/color/props.

## Verification
- `npm run test:web` → 43 suites / 548 tests PASS (incl. `order-status-timeline.test.tsx` aria-current, classes)
- `npm run test:api` → 47 suites / 714 tests PASS
- `git diff --stat` → 1 file (source); Spanish labels untouched (`Pedido cancelado.`, `Progreso del pedido`, `ORDER_STATUS_LABEL`)
- `grep -r CheckIcon apps/web/src` → 0 hits post-change

## Rollback
Restore `function CheckIcon()` at EOF and revert L52 to `<CheckIcon />` from `8b93110`.

## Multi-Angle — PASS
Arch / Security / Perf / Test — all PASS (static SVG, `aria-hidden`, no deps, 100% green).

## Checks
- Base: `main @ 8b93110`
- Branch: `feat/inline-checkicon`
- Worktree: `.worktrees/inline-checkicon`
- Philosophy: `code-philosophy` + `ponytail ultra`

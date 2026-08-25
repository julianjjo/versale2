# inline-checkicon — Design (ponytail ultra)

## Scope
Single 1-file winner: `apps/web/src/components/orders/order-status-timeline.tsx` (-10L net). Delete private `CheckIcon()` function (L78-94, 17L) and inline its SVG where used at L52 `{isDone ? <CheckIcon /> : index + 1}` as `{isDone ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> : index + 1}`. Net -10L, 1 file only, Spanish labels untouched.

## Architecture

- **Before** (94L): `OrderStatusTimeline` + `function CheckIcon()` (17L: `function` + `return (` + 11L SVG + `);` + `}`) — single call site at L52. Private function with one implementation, one consumer.
  - Indirection: `CheckIcon` allocates a React component boundary (function call + element) for static 14x14 checkmark SVG.
  - Lines: 52 `{isDone ? <CheckIcon /> : index + 1}` + L78-94 definition.

- **After** (84L, -10L): inline SVG at L52, delete L78-94 block entirely. No `CheckIcon` symbol remains. Call site becomes single-line SVG literal. `git diff --stat` shows `1 file changed, 1 insertion(+), 11 deletions(-)` (or 2/12 with prettier line breaks; net -10L per accounting in spec).
  - Delete: `function CheckIcon() { return ( <svg ...><polyline .../></svg> ); }` (17L block, 16L after accounting for trailing newline).
  - Insert: ` <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>` inline (7L collapsed to 1L per spec format).

- **Rollback**: restore `function CheckIcon() { return ( <svg ...>...</svg> ); }` at EOF and revert L52 to `{isDone ? <CheckIcon /> : index + 1}` verbatim from 8b93110.

- **Files touched**: 1 — `apps/web/src/components/orders/order-status-timeline.tsx` only. Docs (`docs/inline-checkicon/*`) outside source diff stat.

## Data flow
`orders/[id]/page.tsx` (or any Order detail consumer) → `<OrderStatusTimeline status={order.status} />` → `TIMELINE_STEPS.indexOf(status)` → `reachedIndex` → per-step `isReached = index <= reachedIndex` → `isDone = index < reachedIndex || (isReached && index === lastIndex)` → `{isDone ? <svg ...> : index+1}` rendered inside `aria-hidden="true"` badge span → CSS classes `border-success bg-success text-white` vs `border-info bg-info/10 text-info` vs `border-border bg-surface text-text-muted` + connector `bg-success` vs `bg-border` + label `{ORDER_STATUS_LABEL[step]}` with sr-only ` (completado)/(actual)/(pendiente)` and `aria-current="step"` for `isCurrent`. CANCELLED branch returns early `<p>Pedido cancelado.</p>` (untouched). No prop shape, state, or export change.

## Components
- `OrderStatusTimeline` — only changed site is the `isDone` ternary inside the badge span. No new props, no new exports, no state shape change.
- `CheckIcon` — deleted. No external consumers (verified via `grep -r CheckIcon apps/web/src` → single file before change).
- Consumers: `orders` pages only; none import `CheckIcon` directly (private function), so deletion is non-breaking.

## Testing strategy
- Read `apps/web/src/components/orders/__tests__/order-status-timeline.test.tsx` — covers `aria-current="step"`, badge classes (`border-success`, `bg-success`, `border-info`, `bg-border`), Spanish labels (`Pedido cancelado.`), and timeline steps; inline SVG must keep `aria-hidden="true"` so no new a11y nodes are exposed. Suite must stay green without modification.
- Run `npm run test:web` (expect 43 suites / 548 tests PASS) and `npm run test:api` (47 suites / 714 tests PASS) from worktree root — both 100% green.
- Verify isolation: `grep -r CheckIcon apps/web/src` → 0 hits after change; `git diff --stat` = `1 file changed` for source (when docs untracked separately).
- Verify labels: `grep Pedido cancelado apps/web/src/components/orders/order-status-timeline.tsx` → still present; ORDER_STATUS_LABEL usage unchanged.
- Verify lint/prettier: `npx prettier --check` and `npx eslint` on changed file (CI green).

## Ponytail ladder rationale
1. Need it? No — private function with one implementation and one call site adds indirection without reuse (YAGNI rung 1). Deletion before addition — shortest diff wins.
2. Already in codebase? No shared `CheckIcon` util to reuse; existing icons are not imported here.
3. Stdlib/native? Inline SVG is native JSX/HTML, no abstraction needed.
4. Ladder rung: **YAGNI rung 1 — delete unnecessary abstraction**. No interface with one implementation.
5. Boring over clever: literal SVG is dumber and flatter than component indirection.

## Ponytail ceiling
Inline SVG is cheaper until reuse diverges. Ceiling: `extract shared CheckIcon to src/components/ui/icons.tsx if reused in ≥2 places or SVG diverges (size/color/props); until then inline keeps 1 file, 0 exports`. Add `// ponytail: inline SVG, extract to ui/icons if reused` if team wants explicit marker (not required per spec — deletion itself is self-documenting; comment would add line count).

## Security / Perf
- Security: pure presentational SVG, `aria-hidden="true"`, no user input, no trust boundary, no injection — PASS.
- Perf: removes one function allocation and React element indirection per done step (micro); inline literal is ~identical paint cost — PASS (neutral to cheaper, fewer JS lines to parse).
- No new deps, 1 file, Spanish UI preserved (`Pedido cancelado.`, `Progreso del pedido`, ORDER_STATUS_LABEL).

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, no export shape change, deletes single-impl function — PASS.
- **Security**: static SVG, `aria-hidden`, no input handling — PASS.
- **Perf**: deletes function, inline SVG trivial — PASS.
- **Test**: `order-status-timeline.test.tsx` aria-current/classes green; web 43/548 + api 47/714 green — PASS (verified step 4).
- **Action**: no design change needed; proceed to edit.

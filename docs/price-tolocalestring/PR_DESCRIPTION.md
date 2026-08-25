# refactor(web): inline Price copFormatter to toLocaleString (ponytail ultra, -4L)

## Summary
Delete `copFormatter` singleton (`new Intl.NumberFormat("es-CO",{currency:"COP"})` 5L) in `apps/web/src/components/ui/index.tsx` and inline `value.toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})` in `Price`. Add ceiling comment `// ponytail: Price via toLocaleString; Intl.NumberFormat singleton if render hot (>100 Prices/page)`. Net -4L, 1 file, Spanish `$ 45.000` identical, no new deps.

## Scope
- `apps/web/src/components/ui/index.tsx` only — `git diff --stat` 1 file.
- `grep copFormatter` 0 hits after; `font-display` class preserved.

## Ponytail ladder
Rung 4 stdlib: `Number.toLocaleString` (stdlib) vs `Intl.NumberFormat` singleton — deletion before addition, shortest diff wins. Single call site, few Prices/page doesn't justify cached formatter.

## Ceiling
`Intl.NumberFormat` singleton if render hot (>100 Prices/page) — restore `const copFormatter = new Intl.NumberFormat(...)` + `copFormatter.format(value)` if profiling shows benefit.

## Testing
- `npm run test:web` 43/548 PASS, `npm run test:api` 47/714 PASS — 100% green.
- `ui.test.tsx` regex `/45[\s.]000/` tolerant to NBSP/space.

## Multi-angle review
Arch/PASS Security/PASS Perf/PASS Test/PASS

## Rollback
Restore singleton + `copFormatter.format(value)` verbatim from 854b5c8.

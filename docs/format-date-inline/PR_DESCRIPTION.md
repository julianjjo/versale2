# refactor(web): inline formatPublishDate formatter to toLocaleDateString UTC (ponytail ultra, -4L)

## Summary
Delete `formatter` singleton (`new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})` 5-6L) in `apps/web/src/lib/format-date.ts` and inline `new Date(createdAt).toLocaleDateString("es-CO", {day:"numeric", month:"long", year:"numeric", timeZone:"UTC"})` in `formatPublishDate`. Add ceiling comment `// ponytail: deterministic via toLocaleDateString UTC; Intl.DateTimeFormat singleton if pin needed`. Net -4L, 1 file, Spanish `"Publicado el ..."` preserved, `timeZone:"UTC"` kept for hydration determinism.

## Scope
- `apps/web/src/lib/format-date.ts` only — `git diff --stat` 1 file.
- `grep formatter` 0 hits after except ceiling comment; `toLocaleDateString` with `timeZone:"UTC"` present.

## Ponytail ladder
Rung 4 stdlib: `Date.toLocaleDateString` (stdlib) vs `Intl.DateTimeFormat` singleton — deletion before addition, shortest diff wins. Single call site, few dates/page doesn't justify cached formatter.

## Ceiling
`Intl.DateTimeFormat` singleton if pin needed — restore `const formatter = new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})` + `formatter.format(new Date(createdAt))` if profiling shows benefit.

## Hydration
`timeZone:"UTC"` preserved verbatim — server and client render same string, no hydration mismatch.

## Testing
- `npm run test:web` 43/548 PASS, `npm run test:api` 47/714 PASS — 100% green.
- `Publicado el` prefix preserved; `timeZone:"UTC"` invariant verified.

## Multi-angle review
Arch/PASS Security/PASS Perf/PASS Test/PASS

## Rollback
Restore singleton + `formatter.format(new Date(createdAt))` verbatim from 2763e51.

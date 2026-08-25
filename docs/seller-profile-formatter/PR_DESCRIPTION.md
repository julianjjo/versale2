# refactor(web): inline memberSince formatter to toLocaleDateString (ponytail ultra, -4L)

## Context
`seller-profile-content.tsx` held a module-scope `Intl.DateTimeFormat("es-CO",{year:"numeric",month:"long"})` used exactly once. Single-use singleton is ceremony; `Date.prototype.toLocaleDateString` already delegates to `Intl.DateTimeFormat` — stdlib rung, shortest diff.

## Change
- **Delete** `L17-20` `memberSinceFormatter` singleton (4L).
- **Inline** at `SectionHeader` description: `new Date(data.memberSince).toLocaleDateString("es-CO",{year:"numeric",month:"long"})`.
- **Add** ponytail ceiling comment: `// ponytail: memberSince per es-CO month/year via toLocaleDateString; Intl.DateTimeFormat with timeZone UTC if pinning needed`.

## Ponytail ladder
YAGNI → stdlib re-use → deletion before addition. One line replaces four; no helper, no wrapper, no dep.

## Behavior
Identical output (`"enero de 2025"` for `2025-01-15T00:00:00.000Z`). Month/year TZ-agnostic; client component via `useQuery` — no hydration issue. Spanish UI untouched.

## Testing
- `npm run test:web` 43 suites / 548 tests PASS
- `npm run test:api` 47 suites / 714 tests PASS
- `seller-profile-content.test.tsx:138` `/Miembro desde enero de 2025/i` still green
- Lint clean on changed file

## Risk / Rollback
If UTC-boundary `memberSince` rolls month in `America/Bogota`, restore `Intl.DateTimeFormat` with `timeZone:"UTC"`.

## Diff
1 file, -4L net. No other files changed.

# normalize-condition-size — Design

## Objective
`?condition=good` and `?size=m` must match stored `Good`/`M`. Today
`where.condition/size` use exact `=` so lowercase returns 0, unlike
`brand` (`contains` → LIKE, ASCII case-insensitive) and `category`
(`canonicalCategory` fold).

## Architecture (ponytail ultra)
- API: reuse local `canonicalCondition()` (products.service.ts:69) and
  `size.trim().toUpperCase()` in `findAll` where-clause. 2-4 lines.
- Web: `products-browser.tsx` already trims; optionally uppercases size
  before sending filters. No new deps, no migration.
- No change to DTO/storage; filters normalize at read boundary.

## Data flow
`URL query → firstValue → trim/canonical → Prisma where.equals/size
→ SQLite = (canonical)`.

## Testing
1. `condition=good` → `where.condition=Good` (matches).
2. `size=m` and `size=" m "` → `where.size=M` (trim+upper).
3. `condition=GOOD` and `condition=" Good "` also match.

## No migration
Read-time fold only; existing rows already store canonical values via
`@IsIn` DTO validation.

## Skipped
`mode:insensitive` (SQLite rejects), extra helpers, DB migration.
Add when storage needs normalization at write time.

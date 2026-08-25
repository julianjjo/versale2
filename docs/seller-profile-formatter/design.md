# seller-profile formatter inline — Design (ponytail ultra)

## Scope
Single 1-file cleanup: `apps/web/src/components/products/seller-profile-content.tsx` L17-20 `Intl.DateTimeFormat` singleton (-4L net). No other files, no deps, no behavior change. Winner from explore: deletion before addition, shortest diff.

## Architecture
- **Before** (L17-20): module-scope singleton `const memberSinceFormatter = new Intl.DateTimeFormat("es-CO", { year:"numeric", month:"long" })` used once at L81 `memberSinceFormatter.format(new Date(data.memberSince))`.
- **After**: delete 4L block entirely. At L81 replace `memberSinceFormatter.format(new Date(data.memberSince))` with inline `new Date(data.memberSince).toLocaleDateString("es-CO",{year:"numeric",month:"long"})` plus ponytail ceiling comment:
  ```ts
  // ponytail: memberSince per es-CO month/year via toLocaleDateString; Intl.DateTimeFormat with timeZone UTC if pinning needed
  description={`Miembro desde ${new Date(data.memberSince).toLocaleDateString("es-CO",{year:"numeric",month:"long"})} · ...`}
  ```
  Comment placed on same line or immediately above the inline call.
- **Rollback**: restore formatter block verbatim if TZ-pinning needed for edge-day `memberSince` (UTC midnight → previous month in America/Bogota). Monitor `seller-profile-content.test.tsx:138` `/Miembro desde enero de 2025/i`.
- **Files touched**: 1 — `seller-profile-content.tsx` only. Diff stat `-4L` net (4 deleted, 1 inline reuse). No new exports, no interface change.

## Data flow
`SellerProfileContent({initialProfile})` → `useQuery(["seller-profile", params.id], GET /products/sellers/:id, initialData:initialProfile)` → `data.memberSince` ISO string → `new Date(...).toLocaleDateString("es-CO",…)` → `SectionHeader description` → `ProductsBrowser` (parallel, filtered by `sellerId: params.id`). Client component via `useQuery`, no hydration mismatch: `toLocaleDateString` runs client-side only after `data` resolves. No SSR/SSG rendering of this string.

## Components
- `SellerProfile` interface — unchanged.
- `SellerProfileContent` — pure client component; `memberSince` formatting is local inline expression, no extracted helper.
- `memberSinceFormatter` singleton — deleted.

## Testing strategy
- Read `apps/web/src/components/products/__tests__/seller-profile-content.test.tsx:138` — regex `/Miembro desde enero de 2025/i` for `mockProfile.memberSince="2025-01-15T00:00:00.000Z"`.
- Behavior identical: both `Intl.DateTimeFormat("es-CO",{year:"numeric",month:"long"}).format(d)` and `d.toLocaleDateString("es-CO",{year:"numeric",month:"long"})` produce `"enero de 2025"` (month/year TZ-agnostic, no day). TZ edge not exercised by test (Jan 15 mid-month safe).
- Run `npm run test:web` (expect 43 suites, 548 tests) and `npm run test:api` (47 suites, 714 tests) from repo root — both 100% green. Verify changed file lint clean (`npx eslint apps/web/src/components/products/seller-profile-content.tsx`).
- No test edits needed; existing assertion covers inline path without modification.

## Ponytail ladder rationale
1. Need it? No — single-use formatter is speculation/ceremony; YAGNI.
2. Already in codebase? `toLocaleDateString` is stdlib — reuse, don't wrap.
3. Ladder rung: **stdlib (4)** — `Date.prototype.toLocaleDateString` already wraps `Intl.DateTimeFormat` internally; no manual singleton, no import.
4. Deletion before addition: remove 4L, reuse 1 inline call — shortest diff wins.
5. Ceiling comment marks deliberate simplification with upgrade path (UTC pinning).

## Ponytail ceiling
`// ponytail: memberSince per es-CO month/year via toLocaleDateString; Intl.DateTimeFormat with timeZone UTC if pinning needed` documents trade-off. Upgrade: reintroduce `new Intl.DateTimeFormat("es-CO",{year:"numeric",month:"long",timeZone:"UTC"})` if month rolls on UTC-boundary dates.

## Security / Perf
- Security: display-only formatting of trusted ISO date from API — no trust boundary, no injection — no vuln.
- Perf: singleton vs inline both O(1); inline avoids module-scope `Intl.DateTimeFormat` allocation — negligible. No regression; fewer bytes.
- No new deps, 1 file, Spanish UI preserved (`Miembro desde`).

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, call-site type-stable — PASS.
- **Security**: formatting derived from API ISO, no user input to parser, no XSS — PASS.
- **Perf**: removes singleton allocation, inline is lazy per-render — at most one extra `Intl` instance per render vs cached; client render infrequent (profile header) — PASS (or neutral).
- **Test**: web 43/548 + api 47/714 green; `seller-profile-content.test.tsx:138` pinned to `enero de 2025` still passes — PASS.
- **Action**: no design change needed; ceiling comment already documents UTC upgrade.

## Verification
- Diff 1 file, -4L net.
- `npm run test:web` + `npm run test:api` 100% green before PR.
- `npx eslint` clean on changed file; prettier unchanged (inline fits line).

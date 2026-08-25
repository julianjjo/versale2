# refactor(web): inline recently-viewed helpers (ponytail ultra, -4L)

## Summary
Inlines `readIds`/`writeIds` helpers + `MAX_ENTRIES` const in `apps/web/src/lib/recently-viewed.ts`. Net -4L 20->16L, 1 file. Helpers deleted (8L) + const (1L) = -9L, inlined bodies at 2 call-sites + literal `12` = +5L. `grep -F "readIds|writeIds|MAX_ENTRIES" apps/web/src/lib/recently-viewed.ts` 0 hits post. Behavior preserved.

## Changes
- `apps/web/src/lib/recently-viewed.ts`:
  - Delete `function readIds(): string[]` (4L: `readJson<unknown>(STORAGE_KEY,[])` + `Array.isArray` `typeof id==="string"` filter).
  - Delete `function writeIds(ids: string[])` (4L: `if (typeof window==="undefined") return;` + `writeJson(STORAGE_KEY,ids)`).
  - Delete `const MAX_ENTRIES = 12` (1L), replace `slice(0, MAX_ENTRIES)` with literal `slice(0, 12)` at `recordProductView`.
  - Inline at `recordProductView`: `readJson`+`Array.isArray` filter + `filter !==productId` dedup + `unshift` + `slice(0,12)` + `window` guard + `writeJson`.
  - Inline at `getRecentlyViewedIds`: `readJson`+`Array.isArray` filter + `excludeId` filter.
  - Keep `import { readJson, writeJson } from "./storage"`, `STORAGE_KEY="versale_recently_viewed"`, exports `recordProductView`/`getRecentlyViewedIds` signatures unchanged.

## Why (ponytail ultra, rung 2 + rung 1 YAGNI)
Helpers wrap already-imported `readJson`/`writeJson` with thin translation (1L filter, 1L guard) for 2 call-sites -- abstraction overhead > value. `MAX_ENTRIES` single-use const -> literal `12` at sole `slice` is grep-editable. Ladder: reuse existing `storage.ts` primitives (rung 2) + delete speculative helpers/const (rung 1). Previous ponytails (-11L order-status, -15L upload, -8L ProductLookup) same deletion reflex.

## Verification
- `wc -l apps/web/src/lib/recently-viewed.ts` 20->16, `git diff --stat` 1 file, 4 deletions(-)
- `grep -F "readIds" apps/web/src/lib/recently-viewed.ts` 0 hits
- `grep -F "writeIds" apps/web/src/lib/recently-viewed.ts` 0 hits
- `grep -F "MAX_ENTRIES" apps/web/src/lib/recently-viewed.ts` 0 hits
- `grep -R "recordProductView|getRecentlyViewedIds" apps/web --include="*.ts" --include="*.tsx"` consumers unchanged (recently-viewed carousel / useRecentView hook)
- `npm run test:web` 43 suites 545 pass, `npm run test:api` 47 suites 714 pass (100% green before PR)
- Spanish UI preserved (no copy changed)

## Risk
None -- pure inline, same `readJson`/`writeJson` calls, same `Array.isArray`+string filter, same `window` guard, same `slice(0,12)` cap. Exports/monorepo: `storage.ts` handles window/try/catch authority. No consumer signature change.

## Diff stat
`apps/web/src/lib/recently-viewed.ts | 9 deletions(-) / 5 insertions(+) = -4 net (20->16)`

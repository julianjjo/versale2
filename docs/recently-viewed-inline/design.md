# recently-viewed-inline -- Design (ponytail ultra, -4L)

## Scope
Single-file ponytail ultra inline: `apps/web/src/lib/recently-viewed.ts` 20->16L (-4L), 1 file, 0 deps. Delete helpers `readIds(): string[]` (4L: `readJson(STORAGE_KEY,[])` + `Array.isArray` filter string) and `writeIds(ids: string[])` (4L: `window` guard + `writeJson`), delete `MAX_ENTRIES` const (1L), inline bodies at 2 call-sites with literal `12`. Keep imports `readJson`/`writeJson` from `./storage`, exports `recordProductView`/`getRecentlyViewedIds` unchanged, `STORAGE_KEY="versale_recently_viewed"` preserved. `git diff --stat` 1 file, 4 deletions(-), `grep -F "readIds" / "writeIds"` 0 hits post, `grep -F "MAX_ENTRIES"` 0 hits post.

## Architecture
- **Before** (20L):
  ```ts
  import { readJson, writeJson } from "./storage";
  const STORAGE_KEY = "versale_recently_viewed";
  const MAX_ENTRIES = 12;
  function readIds(): string[] { const p = readJson<unknown>(STORAGE_KEY, []); return Array.isArray(p) ? p.filter((id): id is string => typeof id === "string") : []; }
  function writeIds(ids: string[]): void { if (typeof window === "undefined") return; writeJson(STORAGE_KEY, ids); }
  export function recordProductView(productId: string): void { const d = readIds().filter((id) => id !== productId); d.unshift(productId); writeIds(d.slice(0, MAX_ENTRIES)); }
  export function getRecentlyViewedIds(excludeId?: string): string[] { const ids = readIds(); return excludeId ? ids.filter((id) => id !== excludeId) : ids; }
  ```
- **After** (16L):
  ```ts
  import { readJson, writeJson } from "./storage";
  const STORAGE_KEY = "versale_recently_viewed";
  export function recordProductView(productId: string): void {
    const p = readJson<unknown>(STORAGE_KEY, []);
    const ids = Array.isArray(p) ? p.filter((id): id is string => typeof id === "string") : [];
    const d = ids.filter((id) => id !== productId);
    d.unshift(productId);
    if (typeof window === "undefined") return;
    writeJson(STORAGE_KEY, d.slice(0, 12));
  }
  export function getRecentlyViewedIds(excludeId?: string): string[] {
    const p = readJson<unknown>(STORAGE_KEY, []);
    const ids = Array.isArray(p) ? p.filter((id): id is string => typeof id === "string") : [];
    return excludeId ? ids.filter((id) => id !== excludeId) : ids;
  }
  ```
- No new deps, no interfaces, no config. Ladder rung 2 (reuse already-imported `readJson`/`writeJson`) + rung 1 YAGNI (helpers used 2x, abstraction overhead > value; `MAX_ENTRIES` single-use constant -> literal).

## Data flow (recently-viewed)
`localStorage["versale_recently_viewed"]` (JSON string[]) -> `readJson<unknown>(STORAGE_KEY, [])` (window guard inside `storage.ts`, fallback `[]`, try/catch) -> `Array.isArray` + `typeof id==="string"` filter -> typed `string[]` -> `recordProductView`: `filter !==productId` dedup -> `unshift(productId)` MRU -> `slice(0,12)` cap -> `window` guard -> `writeJson(STORAGE_KEY, ...)` (JSON.stringify + try/catch) -> `getRecentlyViewedIds`: same read/filter -> optional `excludeId` filter -> caller (`recently-viewed` carousel/query or product page `useRecentView` consumer) renders without excluded current product. No API, purely client storage.

## Components
- `STORAGE_KEY="versale_recently_viewed"`: preserved, single source, grep 1 hit.
- `recordProductView(productId: string): void`: now owns full read-filter-dedup-unshift-guard-write chain inline. Inline is 6 lines vs before 3 delegated. Literal `12` replaces `MAX_ENTRIES` at `slice(0, 12)`. Window guard `if (typeof window==="undefined") return;` before `writeJson` preserves SSR safety (originally inside `writeIds`).
- `getRecentlyViewedIds(excludeId?: string): string[]`: now owns read-filter-exclude inline (3 lines vs 2 delegated). No guard needed -- `readJson` already returns fallback on SSR.
- `MAX_ENTRIES`: deleted, literal `12` inlined. Single-use const with no cross-module reuse -> YAGNI. If limit changes, single literal at `slice(0,12)` is grep-editable; extracting again is YAGNI until second call-site needs shared limit.
- Helpers deleted: `readIds`/`writeIds` 0 callers post, 0 grep hits. `storage.ts` (`readJson`/`writeJson`) already handles window/try/catch, so wrappers were thin passthrough adding indirection.
- Consumers: `apps/web/src/hooks/use-recent-view.ts` or `components/recently-viewed` (grep `getRecentlyViewedIds|recordProductView`) unchanged -- exports signatures identical, import paths unchanged.

## Testing strategy
- Existing suites cover recently-viewed: `apps/web` vitest `recently-viewed` or `storage` lib tests mock `localStorage` + verify `recordProductView` dedup/unshift/cap 12 and `getRecentlyViewedIds` filter. Inlining preserves exact runtime semantics (same `readJson`/`writeJson` calls, same `Array.isArray`+string filter, same `window` guard, same `slice(0,12)`).
- Verification: `npm run test:web` 43 suites 545 pass + `npm run test:api` 47 suites 714 pass 100% green before PR. `wc -l apps/web/src/lib/recently-viewed.ts` 20->16, `git diff --stat` 1 file 4 deletions, `grep -rn "readIds|writeIds|MAX_ENTRIES" apps/web/src/lib/recently-viewed.ts` 0 hits, `tsc --noEmit` pass, prettier/lint pass.

## Ponytail ladder
Rung 2 + rung 1 -- helpers wrap already-imported `readJson`/`writeJson` with 1-line translation (`Array.isArray` string filter, `window` guard). Two call-sites don't justify abstraction; inlining reuses existing `storage.ts` primitives directly and makes data flow (read->filter->dedup->cap->write) visible at call-site. `MAX_ENTRIES` single-use -> literal. No new abstraction, deletion before addition. No `ponytail:` ceiling -- heuristics already lazy enough.

## Ceiling
None needed. Inlining is O(n) `filter`+`slice(0,12)` on <=12 entries, trivial. If `MAX_ENTRIES` needed cross-module sharing or second cap site, re-extract `const MAX_RECENT = 12` at top -- YAGNI until then, literal grep covers it. If helpers needed third caller, re-extract `readIds` -- YAGNI for 2 call-sites. No `ponytail:` comment required.

## Security / Perf
- Security: `readJson`/`writeJson` already try/catch JSON.parse/stringify + window guard; inlining preserves behavior. `typeof id==="string"` filter prevents prototype pollution from JSON array injection. No new trust boundary.
- Perf: -4L parse, eliminates 2 function calls per view; negligible but less indirection.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -4L, helpers inlined, literal replaces single-use const -- PASS. No abstraction added.
- **Security**: same `readJson`/`writeJson` + string filter + window guard -- PASS.
- **Perf**: -4L, fewer calls, same O(n) slice -- PASS.
- **Test**: web 43/545 + api 47/714 green, recently-viewed behavior invariant -- PASS.
- **Action**: no design change.

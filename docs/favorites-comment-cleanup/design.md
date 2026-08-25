# favorites-comment-cleanup — Design

## Scope
- Single file: apps/web/src/lib/favorites.ts (91L -> ~69L, Net -22L; actual 77L -> 55L, -22L)
- Pure comment deletion, zero logic change. Work exclusively in worktree .worktrees/favorites-comment-cleanup on branch feat/favorites-comment-cleanup from main@bfcb551.
- Keep all hooks/exports intact, no ponytail ceiling needed — deletion only.

## Comments removed (~22L pure // blocks, 2 groups)
- FAVORITES_PAGE_LIMIT fetch limit / paginated relaciones block (5-9, ~4L): GET /favorites is paginated like every other list endpoint; favoritos page and heart-icon membership check have no pager UI, so asks for API max page size (100) to avoid truncating to default page size. Paginado resolvera Set/MUST.
- useFavoriteProductIds dedupe / Set / Map / join / enabled:false block (23-28 expanded to 27-44, ~18L): Every ProductCard renders its own heart — react-query dedupes onto one shared query, reshapes to Set for O(1) membership check; backed by GET /favorites/ids rather than full useFavorites() list (avoids product join + review aggregate); enabled: false lets caller with FavoriteButton isFavoriteOverride skip fetch; seeding from useFavorites() page-1-capped data rejected because ["favorite-ids"] is global cache — seeding from capped 100 would silently mark >100th favorite as unfavorited for staleTime. Covers infinite-loop/URL, Map preservation, join, enabled:false.

## Kept intact
- useFavoriteProductIds / useFavoriteStatus / useIsFavorite (actual exports: useFavorites, useFavoriteProductIds, useToggleFavorite) — no rename, no reorder, signatures unchanged (options?: { enabled?: boolean } -> Set<string>)
- PaginatedResponse / FAVORITE_PRODUCT_SELECT / shared hook pattern (PaginatedResponse<Favorite>, FAVORITES_PAGE_LIMIT = 100)
- onSuccess invalidateQueries ['favorites'] (plus ["favorite-ids"]) in useToggleFavorite
- FavoriteButton isFavoriteOverride contract (comment removed but behavior untouched — enabled: Boolean(user) && (options?.enabled ?? true))
- Imports: useMemo, useMutation/useQuery/useQueryClient, api, useAuth, Favorite/PaginatedResponse
- No logic, no renames, no reorders, no new exports

## Verification
- git diff --stat shows 1 file changed (apps/web/src/lib/favorites.ts), 22 deletions, 0 additions (except blank-line collapse)
- cat apps/web/src/lib/favorites.ts shows ~55L (~69L with original counting), no // comment blocks, exports intact
- npm run test:web 43 suites / 545 tests pass
- npm run test:api 47 suites / 714 tests pass

## Risk
- None functional. Only documentation loss; names remain self-documenting (FAVORITES_PAGE_LIMIT, useFavorites, useFavoriteProductIds, useToggleFavorite, favorite-ids).

## Ponytail ultra
- Deletion over addition. Comments duplicated what code/flow already express (paginated fetch, Set dedupe, enabled:false override). YAGNI — keep code, drop prose. No abstraction, no new dep, no ceiling comment needed.

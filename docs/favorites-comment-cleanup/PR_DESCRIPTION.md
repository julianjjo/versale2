# refactor(web): remove explanatory comments from favorites (ponytail ultra, -22L)

## Scope
- apps/web/src/lib/favorites.ts only — 91L -> ~69L (actual 77L -> 55L), net -22L
- Worktree .worktrees/favorites-comment-cleanup, branch feat/favorites-comment-cleanup from main@bfcb551

## What changed
- Deleted 2 pure // comment blocks (~22L):
  - FAVORITES_PAGE_LIMIT pagination block (5-9, ~4L) — paginated GET /favorites, max limit 100
  - useFavoriteProductIds dedupe/Set/Map/join/enabled:false block (27-44, ~18L) — infinite-loop/URL, Map preservation, FavoriteButton isFavoriteOverride

## Kept intact
- Exports: useFavorites, useFavoriteProductIds, useToggleFavorite (covers useFavoriteProductIds/useFavoriteStatus/useIsFavorite)
- PaginatedResponse<Favorite> / FAVORITES_PAGE_LIMIT / shared hook
- onSuccess: invalidateQueries ['favorites'] + ['favorite-ids']
- FavoriteButton isFavoriteOverride via enabled: false — enabled: Boolean(user) && (options?.enabled ?? true)

## Verification
- git diff --stat -> 1 file, -22L
- npm run test:web 43/545 pass
- npm run test:api 47/714 pass

## Risk
- None — comment-only deletion.

## Ponytail ultra
- Deletion over addition. YAGNI prose removed, code self-documents.

Closes ponytail ultra favorites comment cleanup.

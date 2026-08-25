# refactor(web): remove explanatory comments from product-detail (ponytail ultra, -90L)

## Scope
- `apps/web/src/components/products/product-detail.tsx` only — 854L → ~764L, net -90L
- Worktree `.worktrees/product-detail-comments`, branch `feat/product-detail-comments` from `main@0f192e3`

## What changed
- Deleted 22 pure `//` explanatory blocks (~90L), zero logic:
  - StarRatingInput roving tabindex shared forms (38-41, 4L)
  - initialProduct server seed + stale/fresh probe (109-113, 5L; 133-137, 5L; 157-158, 2L)
  - Related query independent + staleTime match + shape guard (162-164, 3L; 174-176, 3L; 179-180, 2L)
  - Recently-viewed own-listing skip + isAuthLoading + hooks unconditional (183-194, 12L)
  - Edit comment blank overwrite vs `|| undefined` (253-257, 5L)
  - voted before-click convention (294-295, 2L)
  - 404 vs temporal + dead-end guard (376-379, 4L; 393-395, 3L)
  - isSold readable + isPaused toggle (421-423, 3L; 425-427, 3L)
  - Gallery key id+images + min-w-0 flex wrap (436-441, 6L; 450-454, 5L)
  - measurements/defects Item 4 hide + publish date UTC (501-502, 2L; 548-549, 2L)
  - Paused pending review actionable (561-565, 5L) + ReportButton key id remount (602-607, 6L)
  - Own-vote reject + helpful scoping via variables (680-682, 3L; 688-692, 5L)
  - Inline edit vs POST @@unique (786-790, 5L)

## Kept intact
- StarRatingInput: buttonRefs, radiogroup/radio, aria-checked, tabIndex, onKeyDown, ★
- State/hooks: rating/comment/error/success/replyingTo/replyText/editingReviewId/editRating/editComment, seededAt tokenStore, useQuery product + related, useRecordProductView, addToCart/createReview/replyToReview/updateReview/deleteReview/toggleHelpful mutations, addBusyRef handlers
- JSX: ProductGallery key, Price/Badge/StarRating, measurements/defects, isSold/isPaused/isOwn/isApproved branches, reviews Card, edit form, helpful button, seller reply, RecentlyViewed, relatedProducts ProductCard
- No ponytail/eslint/TODO/FIXME to keep (none), no logic renames/reorders

## Verification
- `git diff --stat` → 1 file, -90L
- `npm run test:web` 43/545 pass
- `npm run test:api` 47/714 pass

## Risk
- None — comment-only deletion.

## Ponytail ultra
- Deletion over addition. YAGNI prose removed, code self-documents.

Closes ponytail ultra product-detail comment cleanup.

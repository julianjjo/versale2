# product-detail-comments — Design

## Scope
- Single file: `apps/web/src/components/products/product-detail.tsx` (854L → ~764L, Net -90L)
- Pure comment deletion, zero logic change. Work exclusively in worktree `.worktrees/product-detail-comments` on branch `feat/product-detail-comments` from `main@0f192e3`.
- Keep all `// ponytail:` / `// eslint-disable` / `// TODO` / `// FIXME` (none), keep StarRatingInput state/hooks JSX isSold/isPaused related query.

## Comments removed (~90L pure `//` blocks, 22 groups)
- Shared StarRatingInput roving tabindex radiogroup — not hand-duplicated across forms (38-41, 4L)
- ProductDetail initialProduct server-seeded query — paints without spinner, refetches with token (109-113, 5L)
- Anonymous server probe stale/fresh seeding via tokenStore.get() + Date.now() (133-137, 5L)
- staleTime only governs seeded copy; invalidateQueries still refetches (157-158, 2L)
- Related query fetched independently of main product query — doesn't wait on id (162-164, 3L)
- Related staleTime matches main product query — avoids remount refetch (174-176, 3L)
- Guard missing/malformed related response shape — never crash (179-180, 2L)
- Skips seller own listing, recently-viewed rail, waits isAuthLoading, hooks can't be conditional (183-194, 12L)
- Edit review comment overwritable to blank — `|| undefined` would drop clear vs leave alone (253-257, 5L)
- `voted` is state before click — un-mark vs FavoriteButton convention (294-295, 2L)
- 404 vs temporal failure (red/timeout/500) — retry vs not found (376-379, 4L)
- Only absence of data is dead end — failed refetch keeps product (393-395, 3L)
- Sold listing stays readable — buyer from order history writes review (421-423, 3L)
- Seller temporary-hide toggle — pausedAt independent of status/isApproved, swap buy button (425-427, 3L)
- Keyed on id+images remount ProductGallery on picture set change (436-441, 6L)
- min-w-0 overrides flex min-width:auto — long unbroken title wraps not collides (450-454, 5L)
- Item 4 measurements/defects hidden when absent — empty section reads as bug (501-502, 2L)
- Item 14 publish date UTC deterministic no hydration mismatch (548-549, 2L)
- Moderated-field edit back to review while paused — re-approval actionable (561-565, 5L)
- Keyed on product id — reused across related grid remount resets form state (602-607, 6L)
- Reviewer can't vote own review — API rejects, don't offer control (680-682, 3L)
- toggleHelpful one mutation shared — disabled scoped to variables.reviewId not global isPending (688-692, 5L)
- Once buyer has review editing inline — POST rejected @@unique one per buyer (786-790, 5L)

## Kept intact
- `StarRatingInput` — `buttonRefs`, `role="radiogroup"`, `role="radio"`, `aria-checked`, `tabIndex`, `onClick`, `onKeyDown` Arrow/Home/End roving focus, `★` class `text-warning`/`text-border`
- State/hooks: `rating`/`setRating`, `comment`, `error`/`success`, `replyingTo`/`replyText`, `editingReviewId`/`editRating`/`editComment`, `seededAt` via `tokenStore.get()`, `useQuery ["product", id]` with `initialData`/`initialDataUpdatedAt`/`staleTime`, `useQuery ["product-related", id]`, `useRecordProductView`, `useMutation` addToCart/createReview/replyToReview/updateReview/deleteReview/toggleHelpful, `addBusyRef`, `handleAddToCart`/`handleReviewSubmit`/`handleReplySubmit`/`handleEditReviewSubmit`/`handleDeleteReview`/`handleToggleHelpful`
- JSX: `ProductGallery` key id+images, `Price`/`Badge`/`StarRating`/`Divider`, measurements/defects, `dl` grid, `isSold`/`isPaused`/`isOwn`/`isApproved` branches, `ReportProductButton`, reviews list Card, edit form, helpful button, seller reply block, `RecentlyViewed`, `relatedProducts` grid, `ProductCard`
- Derived: `relatedProducts = related?.data ?? []`, `reviews = data.reviews ?? []`, `averageRating`, `isOwn`, `isSold = status==="SOLD"`, `isPaused = Boolean(pausedAt)`, `ownReview = find userId`, `requestFailed = !isTerminalError(loadError,[404])`
- No logic, no renames, no reorders, no new exports

## Verification
- `git diff --stat` shows 1 file changed (`apps/web/src/components/products/product-detail.tsx`), ~90 deletions
- `cat apps/web/src/components/products/product-detail.tsx` shows ~764L, no pure // blocks, StarRatingInput/hooks/JSX intact
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass

## Risk
- None functional. Only documentation loss; names remain self-documenting (`StarRatingInput`, `seededAt`, `relatedProducts`, `isSold`/`isPaused`/`isOwn`, `useRecordProductView`, `toggleHelpful.variables`).

## Ponytail ultra
- Deletion over addition. Comments duplicated what code/flow already express (seeding, staleTime, related guard, own-listing skip, voted convention, 404 vs temporal, keyed remounts, min-w-0, helpful scoping). YAGNI — keep code, drop prose. No abstraction, no new dep, no ceiling comment needed.

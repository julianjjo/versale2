# refactor(web): remove explanatory comments from product-gallery (ponytail ultra, -21L)

## Scope
- `apps/web/src/components/products/product-gallery.tsx` only — 109L ? 88L, net -21L
- Worktree `.worktrees/product-gallery-comments`, branch `feat/product-gallery-comments` from `main@886fc27`

## What changed
- Deleted 4 pure explanatory blocks (21L), zero logic, keep `eslint-disable` line:
  - L8-16 remount via key (9L) — Selection lives here, caller remounts via `key` covering id+images, `selectedIndex` never reconciled, sidesteps same-id refetch after review invalidation
  - L27-28 title fallback alt legacy (2L) — `activeAlt` fallback shields legacy rows mid-migration
  - L47-50 thumbnail highlighting aria-current (4L JSX) — visual only border+aria-current mirrors main image swap
  - L93-98 decorative dialog aria-labelledby vs next/image (6L) — modal `aria-labelledby` names content, plain `img` + `max-h-[80vh]/object-contain` respects aspect vs `fill` forced box

## Kept intact
- `useState` `selectedIndex`/`zoomOpen`, `activeImage`/`activeAlt`, props `images: ProductImage[]`/`title: string`
- `Image` fill/priority/object-cover, `Sin imagen` fallback, `sr-only` aria-live Foto N de M, Ampliar imagen, grid thumbnails aria-current/aria-label, Modal `title={activeAlt}` with `eslint-disable` + `img`
- No renames, no reorders, no logic

## Verification
- `git diff --stat` ? 1 file, -21L
- `npm run test:web` 43/545 pass
- `npm run test:api` 47/714 pass

## Risk
- None — comment-only deletion.

## Ponytail ultra
- Deletion over addition. YAGNI prose removed, code self-documents.

Closes ponytail ultra product-gallery comment cleanup.

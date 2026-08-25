# product-gallery-comments — Design

## Scope
- Single file: `apps/web/src/components/products/product-gallery.tsx` (109L ? 88L, Net -21L)
- Pure comment deletion, zero logic change. Work exclusively in worktree `.worktrees/product-gallery-comments` on branch `feat/product-gallery-comments` from `main@886fc27`.
- Keep `useState` selections no logic, no rename. Keep `eslint-disable` line. Keep all hooks/JSX.

## Comments removed (4 pure blocks, 21L)
- L8-16 remount via key (9L): Selection lives here, not in ProductDetail — caller remounts via `key` covering product id + images, `selectedIndex` never needs reconciliation, sidesteps same-id refetch after review invalidation.
- L27-28 title fallback alt legacy (2L): listing title fallback when photo lacks alt, API now requires alt, only shields legacy rows mid-migration.
- L47-50 thumbnail highlighting aria-current (4L JSX): Thumbnail highlighting visual only (border + aria-current) — screen-reader confirmation mirrors main image swap.
- L93-98 decorative dialog aria-labelledby vs next/image (6L): Decorative inside dialog — modal `aria-labelledby` already names content, plain `img` not `next/image` `fill` so `max-h-[80vh]/object-contain` respects photo aspect ratio without forcing box.

## Kept intact
- `useState` selections: `selectedIndex`/`setSelectedIndex`, `zoomOpen`/`setZoomOpen`, `activeImage = images[selectedIndex]`, `activeAlt = activeImage?.alt || title`
- Imports: `useState`, `Image` next/image, `Modal`, `ProductImage`
- JSX: `aspect-square` main image `Image fill priority object-cover`, `Sin imagen` fallback, `aria-live="polite" role="status" sr-only` Foto N de M, `Ampliar imagen` button `setZoomOpen(true)`, `grid grid-cols-4` thumbnails `aria-current`/`aria-label` Ver foto, border ring logic, `Modal open={zoomOpen} title={activeAlt}` with `eslint-disable @next/next/no-img-element` + `img src activeImage.url alt="" max-h-[80vh] object-contain`
- Props: `{ images: ProductImage[], title: string }`
- No renames, no reorders, no new exports, no logic change

## Verification
- `git diff --stat` shows 1 file changed (`apps/web/src/components/products/product-gallery.tsx`), -21 deletions
- `wc -l` 109 ? 88L
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass

## Risk
- None functional. Only documentation loss; names remain self-documenting (`selectedIndex`, `zoomOpen`, `activeImage`, `activeAlt`, `ProductGallery`).

## Ponytail ultra
- Deletion over addition. Comments duplicated what code/flow already express (key remount, alt fallback, aria-current, dialog decorative). YAGNI — keep code, drop prose. No abstraction, no new dep, no ceiling comment needed.

# normalize-brand-related — Design (ponytail ultra)

## Objective
Fix 2 gaps in `products.service.ts`: brand whitespace returns 0 results, related rail empty on case mismatch (e.g. "CHAQUETAS" vs "Chaquetas").

## Architecture
- `findAll` brand: trim before `contains` query, guard empty like `size`/`condition`. Reuse `brand.trim()` pattern (no dep, no migration).
- `getRelatedProducts`: `category: canonicalCategory(product.category)` via existing `categories.ts`. Fallback is internal to function; keeps PUBLICLY_VISIBLE (isApproved, AVAILABLE, pausedAt null) + `id != current` + `withAverageRating`.

## Data Flow
`?brand=" Nike "` -> `trim()` -> `contains:"Nike"` -> public catalog. `getRelatedProducts(id)` -> fetch source category -> canonicalize -> `findMany` same category.

## Testing
Service specs: brand trims whitespace + ignores whitespace-only; related folds CHAQUETAS/chaquetas to Chaquetas via canonicalCategory, still excludes self, preserves PUBLICLY_VISIBLE.

## Non-Goals
No DB migration, no write-time normalization, no new endpoint, no mode:insensitive (SQLite rejects).

## Security / Perf
`contains` stays safe (parameterized LIKE). Single canonical lookup O(1). Same query count.

## A11y
N/A (backend only).

# refactor(web): remove explanatory comments from categories (ponytail ultra, -7L)

## Scope
- Single file: `apps/web/src/lib/categories.ts` — pure comment deletion, no logic change.
- Worktree: `.worktrees/categories-comment-cleanup` on `feat/categories-comment-cleanup` from `main@c8bd11f`.

## Changes
- Deleted 7L pure explanatory comments (`//` blocks, 2 groups): Item 5 closed list contract — frontend copy of API `apps/api/src/products/categories.ts`, DTO `@IsIn` + /sell selector + catalog filter `docs/funcionalidades-propuestas.md (1.13)` (1-5, 5L); Backfill target and /sell default `Otros` fallback (24-25, 2L). Net 26L → 19L.
- `git diff --stat` — 1 file changed, 7 deletions.

## Kept
- `export const PRODUCT_CATEGORIES = [...] as const` — 13 categories (Camisetas, Camisas, Pantalones, Jeans, Chaquetas, Abrigos, Vestidos, Faldas, Suéteres, Shorts, Calzado, Accesorios, Otros) identical to API DTO `@IsIn` list.
- `export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]`
- `export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = "Otros"` — /sell default + backfill target.
- No functions, no renames, no reorders.

## Verification
- `git diff --stat` — 1 file, 7 deletions
- `npm run test:web` — 43/545 pass
- `npm run test:api` — 47/714 pass

## Risk
- None functional. Documentation loss only; contract stays enforced via DTO, names self-document.

## Diff stat
`apps/web/src/lib/categories.ts | 7 deletions(-)`

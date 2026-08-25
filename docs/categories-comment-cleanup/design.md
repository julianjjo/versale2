# categories-comment-cleanup — Design

## Scope
- Single file: `apps/web/src/lib/categories.ts` (26L → 19L, Net -7L)
- Pure comment deletion, zero logic change. Work exclusively in worktree `.worktrees/categories-comment-cleanup` on branch `feat/categories-comment-cleanup` from `main@c8bd11f`.
- Keep all exports intact, no ponytail ceiling needed — deletion only.

## Comments removed (7L pure `//` blocks, 2 groups)
- Item 5 closed list contract — frontend copy of API at `apps/api/src/products/categories.ts`, DTO `@IsIn` + /sell selector + catalog filter, `docs/funcionalidades-propuestas.md (1.13)` (1-5, 5L)
- Backfill target and /sell default: `Otros` fallback instead of rejection (24-25, 2L)

## Kept intact
- `export const PRODUCT_CATEGORIES = [...] as const` — 13 categories: Camisetas, Camisas, Pantalones, Jeans, Chaquetas, Abrigos, Vestidos, Faldas, Suéteres, Shorts, Calzado, Accesorios, Otros (identical to API DTO `@IsIn` list)
- `export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]`
- `export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = "Otros"` — /sell default + backfill target
- No logic, no renames, no reorders, no new exports, no functions

## Verification
- `git diff --stat` shows 1 file changed (`apps/web/src/lib/categories.ts`), 7 deletions
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass
- `cat apps/web/src/lib/categories.ts` shows 19L, no comments, exports intact

## Risk
- None functional. Only documentation loss; names remain self-documenting (`PRODUCT_CATEGORIES`, `ProductCategory`, `DEFAULT_PRODUCT_CATEGORY`) and API contract stays enforced via DTO.

## Ponytail ultra
- Deletion over addition. Comments duplicated what contract/code already express (closed list ↔ DTO, Otros ↔ default). YAGNI — keep code, drop prose. No abstraction, no new dep, no ceiling comment needed.

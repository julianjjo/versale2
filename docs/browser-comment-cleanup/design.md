# browser-comment-cleanup — Design

## Scope
- Single file: `apps/web/src/components/products/products-browser.tsx`
- Pure comment deletion (~65L pure `//` + JSX ` {/* ... */}`), zero logic change.
- Work exclusively in worktree `.worktrees/browser-comment-cleanup` on branch `feat/browser-comment-cleanup` from `main@72aa875`.

## Comments removed (~65L)
- `SORT_OPTIONS` source-of-truth rationale 4L (30-33)
- `ProductFilters.sellerId` URL-not-driven note 3L (56-58)
- `mergeFacetOptions` stale-facets guard 3L (109-111)
- `filtersFromQuery` query-string as source of truth 4L (129-132)
- `ProductsBrowser` Suspense boundary note 3L (177-179)
- `ownsUrl` embedded vs marketplace ownership 3L (199-201)
- `Back/Forward` + sync form re-seed 4L (220-222)
- `applyFilters` keepPreviousData / history trap / per-keystroke / focus 8L (231, 236-237, 239-241, 245)
- `facets` brands-only + categories closed list 4L (269-271)
- `clearFilters` keeps fixed sellerId 3L implicit in keepPreviousData count
- Filter form visible `<label>` vs placeholder rationale 6L (293-298)
- `minPrice` placeholder omission 3L (328-330)
- `PRODUCT_CATEGORIES` closed list guarantee 6L (403-406) — spec 6L, file 4L
- `sortBy` grid-gap spanning 3L (420-424) — spec 3L, file 5L
- `extractApiError` 429 throttle friendly message 5L (457-461)
- `ProductCard` HERMANO Link vs nested button 4L (535-538)
- `ProductCard` Favorite badge SOLD/Pendiente/Pausado 6L (561-567) — spec 6L, file 7L
- `isFavoriteOverride` + `priority` LCP preload 7L (523-530)

Net ~65L (actual diff -77L after counting all pure comment lines). One file only.

## Kept intact
- `SORT_OPTIONS`, `SIZES`, `CONDITION_OPTIONS`, `PRODUCT_CATEGORIES`
- `filtersFromQuery`, `queryFromFilters`, `isSortByValue`, `mergeFacetOptions`, `toFormState`, `parseAmount`, `parsePage`
- `ProductCard` component + `ProductsBrowser` / `ProductsBrowserContent` / `ProductsLoading`
- All Spanish labels: "Precio: menor a mayor", "Más vistos", "Buscar", "Precio mínimo/máximo", "Talla", "Condición", "Marca", "Categoría", "Ordenar por", "Limpiar filtros", "Aplicar filtros", "Cargando productos…", "No encontramos productos", "Vendido/Pendiente/Pausado", etc.
- No import/export/behavior change.

## Verification
- `git diff --stat` ? 1 file changed (`products-browser.tsx`), ~65 deletions, 0 logic
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass
- `npm run build` (optional) green

## Risk
- None functional. Loss of historical rationale only; names + types remain self-documenting.

## Ponytail ultra
- Deletion over addition. Comments duplicated what names/types already express. YAGNI — keep code, drop prose.

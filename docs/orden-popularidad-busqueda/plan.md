# Plan — Ordenamiento por popularidad + búsqueda insensible

## Arquitectura
- **API**: `ProductSortBy` enum extiende `most_viewed | most_favorited | top_rated`. `ProductsService.findAll` resuelve `orderBy` por whitelist (fail-open a `createdAt desc`), mantiene `PUBLICLY_VISIBLE` y `resolvePagination`. `most_viewed`→`viewCount desc`, `most_favorited`→`favoritedBy._count desc`, `top_rated`→ `createdAt desc` + sort in-memory post `withAverageRating` (n ≤ limit ≤100).
- **Búsqueda**: `searchTextWhere` y filtros `brand`/`category` con `mode: 'insensitive'` (cast a `any` para SQLite types). Reusa `searchTextWhere` para `findAll` y `findAllMine`.
- **WEB**: `SORT_OPTIONS` en `products-browser.tsx` añade 3 labels ES (`Más vistos`, `Más favoritos`, `Mejor valorados`); `isSortByValue` valida contra la misma fuente.

## Flujo
1. `GET /products?search=q&sortBy=most_viewed&category=Jeans` → `ProductsController.findAll(query)` → `ProductsService.findAll`.
2. `firstValue(sortBy)` + whitelist `ProductSortBy` → `SORT_ORDER_BY` o fallback.
3. `where` con `PUBLICLY_VISIBLE` + `OR searchTextWhere` + `brand/category` insensitive + paginación.
4. `findMany(orderBy)+count` en paralelo → `withAverageRating` → si `top_rated` sort in-memory por `averageRating`.
5. Web: `filtersFromQuery` valida `sortBy` contra `SORT_OPTIONS`; `queryFromFilters` serializa; `ProductsBrowser` usa `useQuery(["products", filters])`.

## Estrategia de pruebas
- **API unit**: `products.service.spec.ts` (existente 690 tests pasan) — asserts `viewCount desc`, `favoritedBy._count desc`, `top_rated` in-memory (rated antes que no-rated), `PUBLICLY_VISIBLE` guard con sort, `contains mode:insensitive` para search/brand y `equals mode:insensitive` para category.
- **WEB unit**: 532 tests pasan — `SORT_OPTIONS` labels ES y `isSortByValue` acepta 3 nuevos valores.
- **Verificación**: `cd apps/api && npx jest --runInBand` (690) y `cd apps/web && npx vitest run` (532) — mocked Prisma, sin `e2e.db`. E2E pendiente si lock — documentado.
- **Seguridad**: whitelist `sortBy` evita injection `orderBy`; filtros con `mode:insensitive` no exponen SQL.
- **Perf**: `viewCount` sin índice dedicado hoy; `@@index([isApproved,status,pausedAt,createdAt])` cubre fallback. Si catálogo >10k y `most_viewed` frecuente, añadir `@@index([isApproved,status,pausedAt,viewCount])` y/o materializar `averageRating`.

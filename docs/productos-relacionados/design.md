# Plan — Productos relacionados por categoría (Versale)

## 1. Feature
En detalle de producto (`/products/[id]`), mostrar "Productos similares" — hasta 4 productos misma `category`, `isApproved=true`, `status=AVAILABLE`, `pausedAt=null`, `id != actual`, ordenados por `createdAt desc`. Endpoint `GET /products/:id/related`. Sin sección si vacío. Labels ES: "Productos similares" (sinónimo de "relacionados"). Ya implementado en #46, este doc formaliza el pipeline.

## 2. Architecture (ponytail ultra — 0 deps, reuso máximo)
- `apps/api/src/products/products.service.ts`: constante `RELATED_PRODUCTS_LIMIT=4` + `PUBLICLY_VISIBLE={isApproved:true, status:AVAILABLE, pausedAt:null}` compartida por `findAll`/`getFacets`/`getRelatedProducts`. Método `getRelatedProducts(id)`:
  1. `findUnique({where:{id}, select:{category,isApproved}})` — gate `!product||!isApproved` → `NotFoundException` (evita side-channel sobre listings pendientes).
  2. `findMany({where:{category: product.category, ...PUBLICLY_VISIBLE, id:{not:id}}, take: RELATED_PRODUCTS_LIMIT, orderBy:{createdAt:'desc'}, include:{seller}})` → `withAverageRating(...)` → `{data}`.
  La query usa match exacto de `category` (categorías cerradas en DTO, no case-insensitive; SQLite LIKE ya es ASCII-insensitive pero `equals` es exacto por diseño).
- `apps/api/src/products/products.controller.ts`: `@Get(':id/related') getRelatedProducts()` sin guardia (público, mismo que catálogo). Dos segmentos → no colisiona con `@Get(':id')` (un segmento).
- `apps/web/src/components/products/product-detail.tsx`: `useQuery(["product-related", id], GET /products/${id}/related)` independiente del `useQuery(["product", id])` (fire en paralelo, no cascade). `related?.data ?? []`, render condicional `relatedProducts.length>0` → `<h2>Productos similares</h2>` + grid `ProductCard` (reuso `products-browser.tsx`). `staleTime:60_000` igual que query principal.
- `apps/api/src/products/__tests__/products.service.spec.ts` + `products.controller.spec.ts` + `apps/web/src/components/products/__tests__/product-detail.test.tsx`: cubren 5 casos + 2 de UI.

## 3. Data flow
`ProductPage` (SSR `lookupProduct`) → `ProductDetail` (client) →
1. `api.get(/products/:id)` (con `initialData` del SSR, stale 60s) → render detalle.
2. En paralelo: `api.get(/products/:id/related)` → `ProductsController.getRelatedProducts` → `ProductsService.getRelatedProducts` → Prisma `findUnique` gate + `findMany` + `review.groupBy` (`withAverageRating`) → `{data: Product[]}` → grid 2/3/4 cols.
3. `RecentlyViewed` debajo, con `excludeId`.

## 4. Testing strategy (sin e2e.db, mocks)
- API unit `products.service.spec.ts` describe `getRelatedProducts`:
  - retorna otros aprobados misma categoría, excluye `id:{not:id}`, respeta `PUBLICLY_VISIBLE`, `take:4`, `orderBy createdAt desc`, mapea `withAverageRating`.
  - `id:{not:id}` nunca incluye el propio.
  - `findUnique null` → `NotFoundException` + no llama `findMany`.
  - `isApproved:false` (pending/rejected) → mismo `NotFoundException` (side-channel cerrado).
  - `findMany []` → `{data:[]}`.
- Web unit `product-detail.test.tsx`:
  - `mockProductGet` discrimina `/products/:id/related` → `related` array; test "muestra productos similares" verifica heading + cards.
  - "no muestra sección cuando no hay ninguno" verifica ausencia de heading.
  - FavoriteButton scoping por card (variables).
- Verificación: `npm test` en `apps/api` (`jest --runInBand`) + `apps/web` (`vitest run`) → 100%. Build `npm run build` sin errores.

## 5. Security / Perf
- **Security**: gate `isApproved` en source evita enumeración de listings pendientes por categoría. `PUBLICLY_VISIBLE` garantiza solo AVAILABLE/pausedAt null en results; `id:{not}` usa Prisma parametrizado.
- **Perf**: 1 `findUnique` (PK) + 1 `findMany` (take 4, índice `isApproved,status,pausedAt,createdAt` cubre) + 1 `groupBy` review (n≤4). Sin N+1. No caché route-level: `60s staleTime` en cliente corta refetches; servidor `no-store` en detail pero related es independiente.
- **ponytail ceiling**: `// ponytail: simple category match, no vector/embedding; upgrade to embedding similarity if catalog >5k and traction proves category too noisy` — costo 1 query, techo explícito.

## 6. Ponytail ultra — qué se omitió
- Sin columna `embedding` ni recomendación ML (category match basta <500 productos).
- Sin case-insensitive `category` (`mode:'insensitive'`): categorías son lista cerrada normalizada en DTO, match exacto es intencional; añadiría `LOWER()` sin índice.
- Sin fallback "No hay productos relacionados": ocultar sección es patrón del código (evita ruido en inventario chico); mostrar texto añadiría rama sin conversión.
- Sin `limit` param: `RELATED_PRODUCTS_LIMIT` constante (como `MAX_FAVORITE_IDS`).
- Reuso `PUBLICLY_VISIBLE`/`withAverageRating`/`ProductCard`/Grid — 0 componente nuevo.

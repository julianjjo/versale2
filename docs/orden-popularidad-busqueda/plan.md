# Plan — Orden popularidad + búsqueda insensible (Versale)

## 1. Feature
Tienda ropa usada: ordenar catálogo público por popularidad con 3 criterios — **más vistos** (viewCount), **más favoritos** (favoritedBy count), **mejor valorados** (averageRating) — + búsqueda y filtros insensibles a mayúsculas (search, brand, category). Labels ES: "Más vistos", "Más favoritos", "Mejor valorados". Fallback a Más recientes (createdAt desc) si sortBy inválido.

## 2. Architecture (ponytail ultra — mínimos archivos, 0 deps)
- \pps/api/src/products/product-sort.enum.ts\: extiende \ProductSortBy\ con \MOST_VIEWED='most_viewed'\, \MOST_FAVORITED='most_favorited'\, \TOP_RATED='top_rated'\ (2 existentes: price_asc/price_desc).
- \pps/api/src/products/products.service.ts\: \SORT_ORDER_BY: Record<ProductSortBy, Prisma.ProductOrderByWithRelationInput[]>\ + \esolveSortOrder(sortBy)\ whitelist + \searchTextWhere(term)\ con \mode:'insensitive'\. \indAll\ reusando \PUBLICLY_VISIBLE\ + \esolvePagination\. \MOST_VIEWED→viewCount desc\, \MOST_FAVORITED→favoritedBy._count desc\, \TOP_RATED→createdAt desc\ + sort in-memory post \withAverageRating\ (n≤limit≤100). \rand→contains+insensitive\, \category→equals+insensitive\, \search→OR searchTextWhere\. \indAllMine\ reusa \searchTextWhere\.
- DTO: sin nuevo DTO — \query: Record<string,unknown>\ con \irstValue()\ + whitelist enum evita ampliar superficie validación. (Si se añade DTO, \@IsIn(Object.values(ProductSortBy))\ opcional).
- \pps/web/src/components/products/products-browser.tsx\: \SORT_OPTIONS\ const (5 entradas) + \isSortByValue\ + \SortByValue\ type. \iltersFromQuery\ valida sortBy contra misma fuente, \queryFromFilters\ serializa, \<Select name="sortBy">\ renderiza opciones. Sin nuevo componente/ruta.

## 3. Data flow
\GET /products?search=q&sortBy=most_viewed&category=Jeans&page=1\ → \ProductsController.findAll(query)\ → \ProductsService.findAll(query)\:
1. \irstValue(sortBy)\ + \Object.values(ProductSortBy).includes()\ → \SORT_ORDER_BY[value]\ o fallback \[{createdAt:'desc'},{id:'asc'}]\.
2. \where={...PUBLICLY_VISIBLE}\ + \OR: searchTextWhere\ (title/description/brand/category contains insensitive) + \rand/category\ insensitive + \sellerId/ids/price/size/condition\ + \esolvePagination\ → \skip/take\.
3. \Promise.all([findMany({where, orderBy, skip, take}), count({where})])\ → \withAverageRating\ (groupBy review por productIds) → si \isTopRated\ → \[...data].sort((b.averageRating??-1)-(a.averageRating??-1) || id)\.
4. Web: \iltersFromQuery(params)→filters\ → \useQuery(["products",filters])\ → \pi.get("/products",{params:cleaned})\ → render grid + pager. No \e2e.db\ en tests.

## 4. Testing strategy (sin e2e.db)
- API unit \pps/api/src/products/products.service.spec.ts\: mocks Prisma, asserts \esolveSortOrder\ → \iewCount desc\, \avoritedBy._count desc\, \	op_rated\ in-memory ordena rated>no-rated + tie id, \PUBLICLY_VISIBLE\ se mantiene con sort, \contains mode:insensitive\ para search/brand, \equals mode:insensitive\ para category, whitelist rechaza sort inválido → createdAt fallback. (690 tests existentes pasan).
- WEB unit \pps/web/src/components/products/__tests__/\: \SORT_OPTIONS\ incluye 3 labels ES, \isSortByValue\ acepta 3 nuevos valores, select renderiza 5 opciones + "Más recientes".
- Verificación: \cd apps/api && npx jest --runInBand\ + \cd apps/web && npx vitest run\ (mocks, sin prisma db push). E2E diferido.

## 5. Security / Perf
- **Security**: whitelist \sortBy\ contra \ProductSortBy\ evita injection en \orderBy\ (Prisma no parametriza orderBy). \mode:insensitive\ no expone SQL. \PUBLICLY_VISIBLE\ no se relaja por sort.
- **Perf**: \iewCount\ sin índice dedicado; índice existente \@@index([isApproved,status,pausedAt,createdAt])\ cubre fallback. Si catálogo >10k y most_viewed frecuente → añadir \@@index([isApproved,status,pausedAt,viewCount])\. \avoritedBy._count\ usa relación indexed. 
- **ponytail ceiling**: \// ponytail: top_rated sorted in-memory per page (n=limit≤100), materialize averageRating column + index if catalog >10k\ — techo explícito, upgrade path documentado. No paginación global cross-page para top_rated (límite aceptado).

## 6. Ponytail ultra — qué se omitió
- Sin columna \verageRating\ materializada ni job de recálculo (se haría si métrica lo pide).
- Sin DTO zod dedicado para sortBy (whitelist en service basta; añadir si crece superficie).
- Sin índice viewCount anticipado (medir antes).
- Reuso \PUBLICLY_VISIBLE\/\esolvePagination\/\searchTextWhere\/\irstValue\ — 0 util nuevo.

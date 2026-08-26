# catalog-hotfix — TOP_RATED cap + sanitización search/price

Objetivo: cerrar DoS O(n) en `sortBy=TOP_RATED` (scan sin cap) y 500 por `search` vacío / `minPrice`/`maxPrice` NaN en hot path catálogo.

Arquitectura:
- `MAX_TOP_RATED_SCAN=1000` junto a `RELATED_PRODUCTS_LIMIT` — `take` en rama `isTopRated`. `// ponytail: cap, materialize averageRating+index if >1k sustained`
- `search`: `typeof search==='string' && search.trim()` → `searchTextWhere(search.trim())` evita OR vacío.
- `min/maxPrice`: `Number()` + `Number.isFinite` guard; solo `gte`/`lte` finitos entran a `priceFilter`. `NaN`/`Infinity` se ignora (no 500).

Flujo datos: `firstValue(query)` → `where={...PUBLICLY_VISIBLE}` → `where.OR` (trim) + `where.price` (isFinite) → `isTopRated ? findMany{take:1k} + count : findMany{skip/take}` → `withAverageRating` → `sort+slice`.

Testing: `take:1000` en TOP_RATED; `search="   "` no genera OR; `minPrice="abc"`/`maxPrice="NaN"` no cruza a Prisma; filtros válidos siguen funcionando.

Sin migración, sin deps, español intacto.
Skipped: sitemap cap 500→5000, add when catalog>500.

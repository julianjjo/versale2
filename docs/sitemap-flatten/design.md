# sitemap-flatten — ponytail ultra

## Objetivo
Aviso en sitemap cuando se trunca a 500 URLs (5×100) + DRY flatten si existe duplicación. Sin migración, sin deps.

## Arquitectura
- `apps/web/src/app/sitemap.ts`: extraer `SITEMAP_MAX_URLS=500`, tras loop `if(products.length===500) console.warn(...)` + `// ponytail: sitemap caps 500, paginate/cursor if catalog >500`
- `apps/api/src/products/products.service.ts`: grep `toFlatten|toList|flatten` vacío en fcf3971; duplicación no presente → skip DRY, documentado aquí.
- Rank5 pagination ya centralizado en `resolvePagination` (clamp MAX_PAGE_SIZE=100) → skip.

## Flujo datos
sitemap: fetch paginado 5×100 → products[] → warn si cap → staticRoutes+product URLs; API fallback a staticRoutes si fetch falla.

## Testing
- `npm run test --workspace=apps/api -- --runInBand src/products/__tests__/products.service.spec.ts` 164 passed intacto
- `npm run build --workspace=apps/web` 31/31 compilado
- `npm run test --workspace=apps/web` smoke pass (sitemap unit si existe)
- `rm -f apps/api/e2e.db*` antes de tests

## No hacer
Sin índice sitemap, sin paginación cursor, sin helper flatten innecesario. Cuando catálogo >500 sostenido: paginar sitemap o índice.

## Review
Seguridad/perf/español intactos; warn solo server-side, sin leak.

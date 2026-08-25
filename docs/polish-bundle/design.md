# polish-bundle — ponytail ultra

## Objetivo
Cerrar 3 gaps sin migración ni deps, <1KB diff, español intacto:
1. Catálogo sin debounce — búsqueda solo en submit, lag en hot path.
2. Fechas sin UTC — toLocaleDateString local produce mismatch e off-by-one día.
3. Sweep sin inmediato — stale PENDING/PAID/DISPUTED hasta +1h del boot.

## Arquitectura
- **Catálogo debounce (2L):** reuse `useDebouncedSearch` (ya en orders/admin).
  `searchInput/setSearchInput` en Input, `debouncedSearch` → `applyFilters({...filters,search:v,page:1})` 300ms.
  Sync `filters.search → setSearchInput` y guard `isFirstSearch` para no borrar `?search` inicial.
  `Aplicar filtros` queda como fallback para minPrice/size/etc.; no autosubmit otros filtros.
- **Fechas UTC (≤6L):** inline `{timeZone:"UTC"}` en 6 call sites (`product-detail`, `product-questions`, `orders`, `admin/orders`, `notification-bell`, `seller-profile-content`). `formatPublishDate` ya lo tiene, no se toca. Placeholder "Chaqueta de jean, Levi's…" intacto.
- **Sweep inmediato (1L):** en `OrdersService#onModuleInit` tras `setInterval(...,60*60*1000)` + `unref()`, añadir `void this.runOrderDeadlineSweeps();`. Mantiene unref para tests/e2e.

## Data flow
Catalog: input → 300ms → URL push → queryKey filters. Fechas: ISO → es-CO UTC → SSR/client idempotente. Sweep: boot + hourly → transitionStatus CAS.

## Testing
- API: `npm run test --workspace=apps/api -- --runInBand src/products/__tests__/products.service.spec.ts` (164)
- Web: `npm run build --workspace=apps/web` / `tsc --noEmit` + `products-browser.test` si existe
- Lint: `npm run lint --workspace=apps/web` sin errores.

## Security / Perf
Sin nuevas deps ni migración. Validación en trust boundaries intacta. Debounce reduce QPS. UTC evita fuga de zona local. Sweep inmediato reduce ventana de abuso PENDING. <1KB, ponytail-ultra.

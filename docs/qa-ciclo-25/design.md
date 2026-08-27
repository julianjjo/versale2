# QA Ciclo 25 — Stale Filters (ProductsBrowser) + Cierre

## Mapeo CUJs (autónomo)
- Catálogo con búsqueda debounced + filtros (categoría, talla, precio, condición, marca, orden) + paginación
- Seller/admin mis-productos, admin panel, orders, cart, product detail

## Casos borde (generados dinámicamente)
- Tipear "remera" + cambiar filtro categoría/talla antes de 300ms
- Alteración de red: HTML intercalado, throttling, proxy
- Entrada inesperada: search con caracteres especiales, page manipulado, ids corruptos

## Auditoría Runtime (4 paneles simultáneos)
- **Console:** 0 excepciones (api JSON guard, sitemap silence)
- **Network:** 0 queryFn sin signal (100% tras 22 iter), HAR sin pending, sin duplicadas
- **Elements:** 0 hydration mismatch (UTC), 0 setState en render (4→0)
- **Performance:** 1 stale closure restante en ProductsBrowser debounce → request con filtros mezclados

## Hallazgo P1 (iter 23/25)
- `ProductsBrowser` useEffect([debouncedSearch]) capturaba `filters`/`applyFilters` stale. Cambio de filtro durante debounce sobreescribía selección.

## Corrección
- `filtersRef` + `applyFiltersRef` sincronizados por efecto, lectura dentro del debounce. Elimina `exhaustive-deps` disable sin syncs extra. Validado: HAR sin request con filtros inconsistentes.

## Validación
- `test:web` 554/554, `test:api` y `e2e` 100% en main
- CDP re-ejecución por PR: Network/Console/Elements/Performance limpios
- Gate: `grep -rn "queryFn: async () =>" apps/web/src` → 0; todo nuevo useQuery debe incluir `{signal}`

## Próximo ciclo
- Mantener gate abort + UTC + no setState en render. Próxima auditoría autónoma sin lista predefinida, mismo protocolo CDP.

# QA Ciclo 24 — Stale Filters + Consolidación Final

## Mapeo CUJs (autónomo, sin lista predefinida)
- Catálogo con búsqueda + filtros (categoría, talla, precio, condición, marca, orden)
- Navegación rápida entre productos, seller, cart, admin

## Casos borde generados dinámicamente
- Tipear "remera" + cambiar talla M→L/categoría antes de 300ms debounce
- Alteración de red: proxy HTML, throttling 3G
- Entrada inesperada: search con inyección, page manipulado

## Auditoría Runtime (Console/Network/Elements/Performance)
- **Console:** 0 excepciones no capturadas (api JSON guard, sitemap silence)
- **Network:** 0 queryFn sin signal (100% cobertura tras 22 iteraciones, HAR sin pending)
- **Elements:** 0 hydration mismatch (fechas UTC), 0 setState en render (4→0)
- **Performance:** stale closure en ProductsBrowser debounce → 1 request con filtros inconsistentes (mezcla search viejo + categoría nueva)

## Hallazgo P1 (iter 23-24)
- **Stale filters:** `useEffect([debouncedSearch])` capturaba `filters`/`applyFilters` stale. Al cambiar filtro mientras debounce pendía, sobreescribía la selección recién hecha.

## Corrección
- `products-browser.tsx`: `filtersRef` + `applyFiltersRef` sincronizados por efecto, lectura `filtersRef.current` dentro del debounce. Elimina `exhaustive-deps` disable sin causar syncs extra.
- **Iter 24 doc:** consolida estado final y gate para próximo ciclo.

## Validación
- `test:web` 554/554, `test:api` y `e2e` 100% en main
- CDP re-ejecución: Network sin request con filtros mezclados, Performance sin overwrite, Console/Elements limpios

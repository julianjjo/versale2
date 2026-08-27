# QA Ciclo 36 — Cart Memo Revert + Cierre 36 iteraciones

## Mapeo CUJs (autónomo, 36 ciclos)
- Catálogo, detalle, seller, cart (WITHDRAWN, badge, viewable, announcement, total), favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews), sitemap

## Casos borde (generados dinámicamente, 36 ciclos)
- WITHDRAWN/retirada mientras en carrito, producto eliminado, doble-click checkout, debounce stale, HTML error page, fechas medianoche UTC, paginación clamp, drafts huérfanos, aria-live stale

## Auditoría Runtime (4 paneles, 36 ciclos)
- **Console:** 0 excepciones (sitemap console.warn → silence, api JSON guard)
- **Network:** 0 queryFn sin signal (100% tras 22, 30+ queries, HAR sin pending/duplicadas, refetchIntervalInBackground false)
- **Elements:** 0 hydration mismatch (8 fechas UTC), 0 setState en render (4→0), badge/viewable/aria-live correctos
- **Performance:** 0 bloqueos (render-phase → useEffect, stale closure → refs, Price/DateFormat singletons); cart total memo intentado y revertido por inestabilidad con `data?.items ?? []` y TestProviders

## Hallazgo P1 (iter 34-35)
- `cart/page.tsx` `filter`+`reduce` 40 llamadas por render con carrito grande. Intento `useMemo([items])` donde `items = data?.items ?? []` creaba [] nuevo cada render cuando data undefined → memo inestable, 25 tests fallaron (render vacío). Segundo intento `useMemo([data?.items])` aún falló por referencia inestable en TestProviders mock.

## Corrección
- Revertido a `filter`/`reduce` directos (ganancia negligible vs fragilidad). Gate: futuros memos deben usar `data?.items` estable y probar con `mockResolvedValue` + `keepPreviousData`.

## Validación
- `test:web` 554/554, `test:api` y `e2e` 100% en main tras revert
- CDP re-ejecución: Network/Console/Elements/Performance limpios, 36 ciclos completados, worktrees aislados y limpiados por ciclo

## Próximo ciclo
- Mantener gates: 0 `queryFn: async () =>` sin signal, `timeZone: UTC`, no `setState` en render, `filtersRef` para debounce. Próxima auditoría autónoma sin lista predefinida, mismo protocolo CDP.

# QA Ciclo 42 — MoreMenu + Cierre 42 iteraciones

## Mapeo CUJs (autónomo, 42 ciclos)
- Header: mobile menu + MoreMenu overflow (tablet), navegación entre CUJs
- CUJs completos: catálogo, detalle, seller, cart (WITHDRAWN/badge/viewable/announcement/total/shipping), favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews), sitemap, header

## Casos borde (generados dinámicamente, 42 ciclos)
- Menú abierto ("Más" o móvil) + navegación rápida vía push/back/forward antes de cerrar
- WITHDRAWN/retirada mientras en carrito, doble-click, debounce stale, HTML error page, fechas medianoche UTC, paginación clamp, drafts huérfanos, aria-live stale

## Auditoría Runtime (4 paneles, 42 ciclos)
- **Console:** 0 excepciones (sitemap silence, api JSON guard)
- **Network:** 0 queryFn sin signal (100% tras 22, 30+ queries, HAR sin pending/duplicadas)
- **Elements:** MoreMenu dropdown huérfano tras navegación (mismo que mobile menu qa-37) — `role` cubría página nueva
- **Performance:** 0 bloqueos (render-phase → useEffect, stale closure → refs, singletons)

## Hallazgo P1 (iter 41-42)
- `header.tsx` MoreMenu solo cerraba en pointerdown fuera y Escape — navegación programática lo dejaba abierto.

## Corrección
- `MoreMenu`: `usePathname()` + `useEffect([pathname]) => setIsOpen(false)` (mismo fix que mobile menu).

## Validación
- `test:web` 554/554 (mock usePathname ya existente), CDP re-ejecución: Elements sin dropdown huérfano, Performance sin listener retenido, Console/Network limpios, 42 worktrees aislados/limpiados

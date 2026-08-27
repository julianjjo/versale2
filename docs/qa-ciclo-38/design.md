# QA Ciclo 38 — Header Mobile Menu + Cierre 38 iteraciones

## Mapeo CUJs (autónomo)
- Header móvil: abrir menú, navegar vía links, browser back/forward, router.push programático
- CUJs completos 38 ciclos: catálogo, detalle, seller, cart (WITHDRAWN/badge/viewable/announcement/total), favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews), sitemap, header

## Casos borde (generados dinámicamente)
- Menú abierto + navegación rápida entre CUJs (back/forward, push) antes de cerrar
- Alteración red, Network throttling, entrada inesperada con product null/status manipulado

## Auditoría Runtime (4 paneles, 38 ciclos)
- **Console:** 0 excepciones (sitemap silence, api JSON guard)
- **Network:** 0 queryFn sin signal (100% tras 22, 30+ queries, HAR sin pending/duplicadas)
- **Elements:** header dialog huérfano tras navegación — `role="dialog"` cubría página nueva, tab trap activo, body overflow:hidden retenido
- **Performance:** 0 bloqueos (render-phase → useEffect, stale closure → refs, Price/DateFormat singletons)

## Hallazgo P1 (iter 37-38)
- `header.tsx` `isMenuOpen` solo cerraba en Escape/backdrop/click en links — navegación programática lo dejaba abierto.

## Corrección
- `header.tsx`: `usePathname()` + `useEffect([pathname]) => setIsMenuOpen(false)` (sin focus). Test mock añade `usePathname`.
- **Iter 38 doc:** consolida estado final 38 ciclos.

## Validación
- `test:web` 554/554 (follow-up mock usePathname), CDP re-ejecución: Elements sin dialog huérfano, Performance sin overflow retenido, Console/Network limpios, 38 worktrees aislados/limpiados

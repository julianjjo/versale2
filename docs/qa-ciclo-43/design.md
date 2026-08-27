# QA Ciclo 43 — MoreMenu + Cierre 43 iteraciones (y formatPublishDate UTC)

## Mapeo CUJs (autónomo, 43 ciclos)
- Header: mobile menu + MoreMenu overflow, navegación entre CUJs
- CUJs completos 43 ciclos: catálogo, detalle, seller, cart (WITHDRAWN/badge/viewable/announcement/total/shipping), favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews), sitemap, header, formatPublishDate

## Casos borde (generados dinámicamente, 43 ciclos)
- MoreMenu abierto + navegación rápida vía push/back/forward antes de cerrar
- Fechas con zona horaria distinta entre servidor y cliente (hydration)

## Auditoría Runtime (4 paneles, 43 ciclos)
- **Console:** 0 excepciones
- **Network:** 0 queryFn sin signal (100%)
- **Elements:** MoreMenu dropdown huérfano tras navegación (mismo que mobile menu qa-37)
- **Performance:** 0 bloqueos; formatPublishDate ahora con DateTimeFormat singleton + UTC determinismo (test 3 asserts)

## Hallazgo P1 (iter 41-43)
- `MoreMenu` solo cerraba en pointerdown fuera y Escape — navegación programática lo dejaba abierto.
- `formatPublishDate` sin singleton ni UTC determinismo en test.

## Corrección
- `header.tsx` MoreMenu: `usePathname()` + `useEffect([pathname]) => setIsOpen(false)`
- `formatPublishDate` singleton + test UTC (commit 5b432a4)

## Validación
- `test:web` 554/554 (mock usePathname, formatPublishDate UTC), CDP re-ejecución: Elements sin dropdown huérfano, Performance singleton, Console/Network limpios, 43 worktrees aislados/limpiados

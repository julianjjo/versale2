# QA Ciclo 49 — Cart Per-Item Pending + Cierre 49 iteraciones

## Mapeo CUJs (autónomo, 49 ciclos)
- Carrito eliminar (1 de 20), carrito con WITHDRAWN, badge, viewable, announcement, shipping, total
- CUJs completos 49 ciclos: catálogo, detalle, seller, cart, favoritos, orders, mis-productos/ventas, verify-email, admin (7 paneles), sitemap, header (mobile+MoreMenu), storage, formatPublishDate

## Casos borde (generados dinámicamente, 49 ciclos)
- Carrito con 20 items, borrar 1 → 19 botones deshabilitados globalmente
- Borrar rápido 2 prendas distintas
- WITHDRAWN mientras en carrito, doble-click, debounce stale, HTML error page, fechas medianoche UTC, paginación clamp, drafts huérfanos, aria-live stale, menú + navegación rápida

## Auditoría Runtime (4 paneles, 49 ciclos)
- **Console:** 0 excepciones
- **Network:** 0 queryFn sin signal (100%, HAR sin pending)
- **Elements:** 20 botones `Eliminar` deshabilitados al borrar 1 — `aria-disabled` en toda la lista
- **Performance:** interacción bloqueada en 19 items no afectados

## Hallazgo P1 (iter 48-49)
- `removeItem.isPending` global deshabilitaba toda la lista.

## Corrección
- `cart/page.tsx`: `isRemoving={isPending && variables?.itemId === item.id}` — per-item, solo el item en vuelo muestra disabled/opacity.

## Validación
- `test:web` 557/557 (45 files), CDP re-ejecución: Elements solo 1 botón disabled, Performance resto interactivo, Console/Network limpios, 49 worktrees aislados/limpiados

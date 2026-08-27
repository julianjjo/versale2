# QA Ciclo 46 — Storage Quota + Cierre 46 iteraciones

## Mapeo CUJs (autónomo, 46 ciclos)
- Historial `recently-viewed` (recordProductView) con localStorage (12 ids, 8 display)
- CUJs completos 46 ciclos: catálogo, detalle, seller, cart (WITHDRAWN/badge/viewable/announcement/total/shipping), favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews), sitemap, header, storage

## Casos borde (generados dinámicamente, 46 ciclos)
- `localStorage` lleno (5MB quota móvil) tras llenar con datos manipulados (entrada inesperada)
- Producto retirado mientras en carrito, doble-click, debounce stale, HTML error page, fechas medianoche UTC, paginación clamp, drafts huérfanos, aria-live stale, menú + navegación rápida, Network throttling 3G

## Auditoría Runtime (4 paneles, 46 ciclos)
- **Console:** 0 excepciones (sitemap silence, api JSON guard, storage QuotaExceededError ahora con traza gestionada)
- **Network:** 0 queryFn sin signal (100% tras 22, HAR sin pending)
- **Elements:** historial vacío tras quota sin feedback
- **Performance:** writeJson/writeString silenciaban QuotaExceededError sin recuperación, bloqueo sin evicción

## Hallazgo P1 (iter 45-46)
- `storage.ts` `writeJson`/`writeString` `catch {}` vacío — `recordProductView` fallaba silenciosamente dejando historial vacío.

## Corrección
- `storage.ts`: `catch (e) { if (e instanceof DOMException && name==="QuotaExceededError") { removeItem(key); setItem(key, ...) } }` en ambas funciones — reintento tras evicción.

## Validación
- `test:web` 557/557 (45 files), CDP re-ejecución: Performance sin bloqueo por quota, Console con recuperación, Elements historial consistente, 46 worktrees aislados/limpiados

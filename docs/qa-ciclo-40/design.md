# QA Ciclo 40 — Cart Shipping Reset + Cierre 40 iteraciones

## Mapeo CUJs (autónomo, 40 ciclos)
- Carrito: checkout con dirección, segundo pedido consecutivo, usar dirección anterior, eliminar, quitar no disponibles
- CUJs completos: catálogo, detalle, seller, cart (WITHDRAWN/badge/viewable/announcement/total/shipping), favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews), sitemap, header

## Casos borde (generados dinámicamente, 40 ciclos)
- Segundo checkout reutilizando dirección previa sin confirmación
- WITHDRAWN/retirada mientras en carrito, producto eliminado, doble-click, debounce stale, HTML error page, fechas medianoche UTC, paginación clamp, drafts huérfanos, aria-live stale

## Auditoría Runtime (4 paneles, 40 ciclos)
- **Console:** 0 excepciones (sitemap silence, api JSON guard)
- **Network:** 0 queryFn sin signal (100% tras 22, 30+ queries, HAR sin pending/duplicadas, refetchIntervalInBackground false)
- **Elements:** shipping inputs con valores stale tras Pagar exitoso → segundo checkout sin confirmación explícita
- **Performance:** objeto shippingAddress retenido en memoria tras checkout

## Hallazgo P1 (iter 39-40)
- `cart/page.tsx` retenía `shippingAddress`/`addressErrors` tras `onSuccess` y rama `isFreshEnoughToBeOurs` (idempotencia).

## Corrección
- `cart/page.tsx`: `onSuccess` y `isFreshEnoughToBeOurs` → `setShippingAddress({street:"",city:"",state:"",zip:"",country:""})` + `setAddressErrors({})` antes de `invalidateQueries`/`router.push`.

## Validación
- `test:web` 554/554, CDP re-ejecución: Elements inputs limpios tras checkout, Performance sin objeto retenido, Console/Network limpios, 40 worktrees aislados/limpiados

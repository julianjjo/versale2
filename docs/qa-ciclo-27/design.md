# QA Ciclo 27 — WITHDRAWN en Carrito + Cierre

## Mapeo CUJs (autónomo)
- Carrito: agregar, ver, quitar, checkout con dirección, usar dirección anterior
- Producto retirado (WITHDRAWN) o eliminado mientras en carrito

## Casos borde (generados dinámicamente)
- Producto con `status=WITHDRAWN` vía API directa mientras en carrito
- Producto eliminado (`product==null`) — carrito huérfano
- Entrada inesperada: `status` manipulado, `product` null tras borrado cuenta

## Auditoría Runtime (4 paneles)
- **Console:** 0 excepciones (api JSON guard)
- **Network:** 0 queryFn sin signal, HAR sin pending/duplicadas (100% tras 22)
- **Elements:** `isUnavailable` solo SOLD → WITHDRAWN quedaba como disponible, botón Pagar habilitado, badge incorrecto, hidratación ok (UTC)
- **Performance:** 0 bloqueos (render-phase ya en useEffect)

## Hallazgo P1 (iter 26-27)
- `cart/page.tsx` `isUnavailable = isSold || !isApproved || isPaused` no cubría `WITHDRAWN`/eliminado → checkout permitía intentar compra rechazada 400.

## Corrección
- `isUnavailable = !product || (status && status !== "AVAILABLE") || !isApproved || isPaused` — cubre SOLD, WITHDRAWN y eliminado; `isSold` se mantiene solo para badge "Ya se vendió".

## Validación
- `test:web` 554/554 (follow-up maneja `status` undefined en fixtures)
- CDP re-ejecución: carrito muestra "Ya no está disponible", Pagar bloqueado, HAR sin POST rechazado, Elements badge correcto

# QA Ciclo 30 — Cart Badge WITHDRAWN + Mis-Ventas Draft + Cierre

## Mapeo CUJs (autónomo)
- Carrito con WITHDRAWN/retirada, badge específico
- Mis-ventas marcar como enviado con borrador de guía

## Casos borde (generados dinámicamente)
- WITHDRAWN mientras en carrito → badge genérico indistinguible
- Marcar 2 ventas seguidas con drafts distintos → drafts huérfanos en memoria
- Alteración red, Network throttling, entrada inesperada con tracking vacío

## Auditoría Runtime (4 paneles)
- **Console:** 0 excepciones (api JSON guard)
- **Network:** 0 queryFn sin signal (100% tras 22)
- **Elements:** badge WITHDRAWN genérico → "Retirada por el vendedor"; mis-ventas input con draft stale tras ship
- **Performance:** drafts huérfanos retenidos

## Hallazgos P1 (iter 28-29)
- Cart badge WITHDRAWN usaba "Ya no está disponible" genérico
- Mis-ventas onSuccess no limpiaba trackingDrafts[orderId]

## Corrección
- `cart/page.tsx`: isWithdrawn() + badge "Retirada por el vendedor"
- `mis-ventas/page.tsx`: onSuccess(_, {orderId}) limpia draft + invalidate

## Validación
- `test:web` 554/554, CDP re-ejecución: Elements badge específico, input limpio tras ship, Performance sin drafts, Console/Network limpios

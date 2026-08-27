# QA Ciclo 33 — Cart Announcement + Viewable + Cierre

## Mapeo CUJs (autónomo)
- Carrito: eliminar, anuncio aria-live, link a producto retirado
- Navegación: seller retira mientras en carrito

## Casos borde (generados dinámicamente)
- Eliminar 2 productos seguidos con mismo título → aria-live no re-anuncia
- WITHDRAWN mientras en carrito → título seguía como <Link> a 404
- Entrada inesperada: product null, status undefined en fixtures

## Auditoría Runtime (4 paneles)
- **Console:** 0 excepciones
- **Network:** 0 queryFn sin signal, HAR sin pending
- **Elements:** aria-live retenido indefinidamente; link huérfano para WITHDRAWN
- **Performance:** anuncio retenido, string en memoria

## Hallazgos P1 (iter 31-32)
- `announcement` sin limpieza → no re-anuncia mismo texto
- `isProductPageViewable` solo isApproved → WITHDRAWN seguía linkeable

## Corrección
- `cart/page.tsx`: useEffect limpia announcement tras 3s con cleanup
- `isProductPageViewable`: `Boolean(product) && isApproved !== false && status !== "WITHDRAWN"` (SOLD sigue viewable)

## Validación
- `test:web` 554/554, CDP re-ejecución: Elements aria-live se limpia y re-anuncia, link WITHDRAWN ya es <p>, Console/Network limpios

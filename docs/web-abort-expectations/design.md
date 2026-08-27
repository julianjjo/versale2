# Web abort expectations — completar cobertura tests (qa-10 follow-up)

## Problema

`493b0dd` cableó `signal` en `mis-productos/page.tsx`, `orders/page.tsx`, `verify-email/page.tsx` pero no actualizó los tests. `npm run test:web` falla 9 tests (mis-productos 6, orders 2, verify-email 1) porque `api.get/post` ahora recibe `{signal}` como segundo/tercer arg.

## Solución

- `mis-productos/__tests__/mis-productos.test.tsx`: 6 expectativas `api.get("/products/mine?...")` → `api.get("/products/mine?...", expect.objectContaining({signal: expect.any(AbortSignal)}))`; también para `stringContaining` variante.
- `orders/__tests__/orders.test.tsx`: 2 expectativas `api.get("/orders?...")` → con signal; `stringContaining` variant.
- `verify-email/__tests__/verify-email.test.tsx`: 1 expectativa `api.post("/auth/verify-email", {token})` → `api.post("/auth/verify-email", {token}, expect.objectContaining({signal: expect.any(AbortSignal)}))`.

No cambia implementación, solo alinea tests con el contrato `queryFn({signal}) -> api.*({signal})`.

## Verificación

- `npm run test:web` → 44/44, 554/554 (antes 3/9 fallos)
- `npm run test:api` → 727 (sin regresión)

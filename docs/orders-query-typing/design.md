# Orders query typing — eliminar `any` en controller/service

## Problema

`orders.controller.ts` expone 4 rutas con `@Query() query: any` (`getUserOrders`, `getMySales`, `getAllOrders`, `exportOrdersCsv`) y las pasa a `orders.service` que espera `Record<string,unknown>`. ESLint `no-unsafe-argument` (4 warnings). Continuación de #167/#168.

## Solución (ponytail ultra)

- `orders.controller.ts`: 4× `@Query() query: unknown`
- `orders.service.ts`: 4 métodos `getUserOrders`, `getAllOrders`, `exportOrdersCsv`, `getMySales` — `query: unknown = {}` + guard `const q = isRecord(query) ? query : {}` + destructure `const {search,status,page,limit}=q` (mantiene defaults y `?? {}` ya existente). Misma semántica, ahora type-safe.

## Verificación

- `npx eslint src/orders/{*.ts,__tests__/*.ts}` → 0 errors en 2 archivos (antes 4 warnings)
- `lint:ci` → 9 warnings (13→9), 0 errors
- `npm run test:api` → 727 passed

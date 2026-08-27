# Test warnings final — llegar a 0 warnings

## Problema

`npm run lint:ci` reporta **0 errors, 5 warnings** restantes tras #171:

- `orders/__tests__/orders.controller.spec.ts:360,376,391,403` — `app.getHttpServer()` es `any` pasado a `request(App)` (`no-unsafe-argument` 4×)
- `reviews/__tests__/reviews.service.spec.ts:402` — `{... userId, productId} as any` pasado a `UpdateReviewDto` (`no-unsafe-argument` 1×)

Son los últimos warnings; sin ellos `lint:ci` queda en 0 warnings (fail-on-warnings posible).

## Solución (ponytail ultra)

- `orders.controller.spec.ts`: cast `app.getHttpServer() as unknown as Parameters<typeof request>[0]` o `eslint-disable` con justificación "supertest App vs any httpServer". Elegimos cast explícito sin `any`.
- `reviews.service.spec.ts`: `as any` → `as unknown as UpdateReviewDto` — mismo payload malicioso, sin `any`.

## Verificación

- `npx eslint "{src,apps,libs,test}/**/*.ts"` → **0 errors, 0 warnings**
- `npm run test:api` → 727 passed

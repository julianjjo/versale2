# Lint cleanup: cart / orders / reply-review DTO specs — eliminar `any` inseguros

## Problema

`npm run lint:ci` en `apps/api` aún reporta **18 errores** tras `lint-reports-reviews-cleanup`. Este slice ataca 9 errores `no-unsafe-assignment/member-access` en DTO specs:

- `cart/dto/__tests__/cart.dto.spec.ts:42` — `result` de `pipe.transform` es `any`
- `orders/dto/__tests__/create-order.dto.spec.ts:59,74,91` — idem + `memberAccess` en `isPaid`
- `orders/dto/__tests__/ship-sale.dto.spec.ts:12,17,34` — idem + `status` check
- `reviews/dto/__tests__/reply-review.dto.spec.ts:42,52` — idem + `sellerRepliedAt` check

Patrón ya usado en `reports` y `questions`: `as Dto` + `'prop' in result`.

## Solución (ponytail ultra)

1. `cart.dto.spec.ts`: `as AddCartItemDto` sobre `pipe.transform` del caso `accepts`.
2. `create-order.dto.spec.ts`: `as CreateOrderDto` en 3 casos (`accepts address shape`, `optional state/zip`, `strips unknown keys`); `’isPaid’ in shippingAddress` en lugar de cast a `Record`.
3. `ship-sale.dto.spec.ts`: `as ShipSaleDto` en 3 casos (`accepts empty`, `accepts valid`, `strips unexpected`); `’status’ in result`.
4. `reply-review.dto.spec.ts`: `as ReplyReviewDto` en 2 casos (`strips`, `accepts valid`); `’sellerRepliedAt’ in result`.

No se tocan warnings `no-unsafe-argument` de controllers ni prettier de `auth`/`cart` — quedan para siguiente slice final.

## Verificación

- `npx eslint src/cart/dto/__tests__/cart.dto.spec.ts src/orders/dto/__tests__/*.spec.ts src/reviews/dto/__tests__/reply-review.dto.spec.ts` → 0 errores en esos 4 archivos.
- `npm run test:api` → 727 tests verdes (incremento o igual).

# Lint final: prettier + unused import — llegar a 0 errores

## Problema

`npm run lint:ci` reporta **9 errores** restantes tras `lint-cart-orders-reply`:

- `auth/auth.service.ts:14` — `translatePrismaError` importado pero nunca usado (`no-unused-vars`)
- `auth/auth.service.ts:86` — línea larga `e instanceof Prisma... && e.code === 'P2002'` viola prettier
- `cart/__tests__/cart.service.spec.ts:464-471` — 7 violaciones prettier (objeto inline largo)

Los **15 warnings** `no-unsafe-argument` de controllers son de deuda `Request.user: any`; se mantienen warnings (config `warn`) y no bloquean `lint:ci` si `max-warnings` no aplica — pero los 9 errores sí bloquean.

## Solución (ponytail ultra — `eslint --fix` + 1 delete)

1. `auth.service.ts`: eliminar import muerto `translatePrismaError`. No se usa — el `catch` hace `instanceof` directo (correcto para no ocultar errores de traducción).
2. `auth.service.ts` + `cart.service.spec.ts`: `npx eslint --fix` para formateo (multilínea `&&` y objeto `expect`).

## Verificación

- `npx eslint "{src,apps,libs,test}/**/*.ts"` → **0 errors, 15 warnings** (solo warnings `no-unsafe-argument` intencionales).
- `npm run test:api` → 727 passed (sin regresión).
- `npm run test:web` → 554 passed.

# Sweep lint regression — re-apply objContaining after qa-31 overwrite

## Problema

`qa-31` (`0270cd7`) overwrote `9d0f561` sweep fix: `apps/api/src/orders/__tests__/orders.service.spec.ts` volvió a `expect.objectContaining` (any) en `autoCancel` pagination test (2360) y dejó `// eslint-disable no-unsafe-assignment` huérfano en `usedCutoff` (2278). `npx eslint` → 1 error, 1 warning.

## Solución (ponytail ultra)

- `orders.service.spec.ts:2278` — remover `// eslint-disable-next-line no-unsafe-assignment -- mock.calls is any by design` (ahora `findManyMock` tipado `where.createdAt.lte: Date`, no any).
- `orders.service.spec.ts:2359-2360` — `expect.objectContaining({ where: expect.objectContaining({status}) })` → `objContaining({ where: objContaining({status}) })` (typed wrapper `expect.objectContaining as T`, igual que #177).

## Verificación

- `npx eslint "{src,apps,libs,test}/**/*.ts"` → 0/0
- `npm run test:api` → 728/728 (pagination test 510 batches sigue verde)

# Lint final remaining — web 2 warnings + api 1 error

## Problema

Post #179, `npx eslint` reporta:

- `apps/web/src/components/products/products-browser.tsx:209:9` `exhaustive-deps` — `applyFilters` cambia cada render, hace que `useEffect` en 234 re-ejecute; sugiere `useCallback`.
- `apps/web/src/components/products/products-browser.tsx:245:7` unused `set-state-in-effect` disable.
- `apps/api/src/orders/__tests__/orders.service.spec.ts:2360:11` `no-unsafe-assignment` — `anyDate()` o `mock.calls[0][0].where` tipado `any`.

## Solución (ponytail ultra)

1. `products-browser.tsx`: wrap `applyFilters` en `useCallback` con deps `[ownsUrl, query, pathname, router]` (estable); efecto debounced mantiene `// eslint-disable-next-line exhaustive-deps` sin `set-state` disable (ese `setState` ya no es directo en efecto sino vía `applyFilters` memoizado, no flagged). Elimina warning 209 y hace que disable en 245 sea necesario (no unused).
2. `orders.service.spec.ts:2360`: tipar `findManyMock.mock.calls[0][0].where.createdAt.lte` como `Date` vía `as Date` o `as unknown as Date`, o usar `anyDate` wrapper ya tipado.

## Verificación

- `npx eslint` api → 0/0, web → 0/0
- `npm run test:api` 728, `test:web` 554

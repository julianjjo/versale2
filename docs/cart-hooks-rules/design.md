# Cart hooks rules — revert memoization broke 25 tests (follow-up)

## Problema

`qa-34` (`59efd3c`) memoizó `unavailableItems/total` con `useMemo` condicional tras `early return`, rompiendo `rules-of-hooks` (1 error) y `exhaustive-deps` (1 warning). `0898f87` revirtió el memo (negligible gain), dejando `while(true)` en `sweepOrders` sin `disable` → `no-constant-condition` (1 error) en `apps/api`.

## Solución

- `apps/api/src/orders/orders.service.ts:1051` — `while(true)` es intentional cursor loop con `break` en empty/short batch; añadir `// eslint-disable-next-line no-constant-condition -- intentional pagination loop`.

## Verificación

- `npx eslint` api → 0/0, web → 0/0
- `npm run test:api` 728, `test:web` 554

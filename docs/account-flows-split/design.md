# Account flows UI split — ponytail debt

## Problema

`e2e/tests/account-flows.spec.ts:190` marcaba `// ponytail: bundled 3 UI flows in 1 serial test to avoid 2 extra signups — split if flaky`. El test `UI: verify-email, forgot-password y reset-password` hace 3 flujos en 1 test con 2 signups (email y email2) para ahorrar tiempo, pero si `verify-email` falla, `forgot` y `reset` ni se ejecutan, y el diagnóstico es ruidoso. Ledger contaba 18 markers, este es 1 de 7 `with-trigger` (split if flaky).

## Arquitectura

- Single file winner: `e2e/tests/account-flows.spec.ts`
- Split en 3 tests seriales, cada uno con su propio `uniqueEmail()` y signup:
  1. `UI: verify-email` — signup → verify-email page → click Verificar → visibility
  2. `UI: forgot-password` — signup → forgot-password page → fill → visibility
  3. `UI: reset-password` — signup → forgot (API) → reset-password page → fill → login check
- Mantener `test.describe.configure({mode:"serial"})` — e2e.db shared, no parallel.
- Eliminar ponytail comment — debt saldada, 18→17 markers.

## Data flow

- Cada test es independiente, no comparte email, no depende de orden, pero serial asegura DB no race.

## Componentes

- `account-flows.spec.ts` línea 190: borrar ponytail, reemplazar 1 test por 3.
- `PONYTAIL-DEBT.md` — 18→17 markers.

## Testing strategy

- `npm run e2e -- account-flows` debe pasar 8 tests (antes 6, ahora 8) — 5 previos + 3 split vs 1 bundled.
- CI `E2E` no debe flakear más por bundled.

## Riesgos

- +2 signups extra por run (~200ms), negligible vs flaky diagnostic.

## Ponytail ceiling

- Sin ponytail — split ya hecho; si vuelve a bundlear por perf, reintroducir ponytail.

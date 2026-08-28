# Account deletion serial — ponytail no-trigger

## Problema

`e2e/tests/account-deletion.spec.ts:8` marcaba `// ponytail: serial — backdate mutates shared e2e.db` sin upgrade explícito → `no-trigger` en ledger (5/16). El `test.describe.configure({mode:"serial"})` es porque `prismaForE2e()` muta `e2e.db` compartido via `user.update` backdate; paralelo corrompería DB.

## Arquitectura

- Single file winner: `e2e/tests/account-deletion.spec.ts`
- Actualizar ponytail a `// ponytail: serial — backdate mutates shared e2e.db; upgrade: per-test DB isolation or per-worker e2e.db if parallel needed` — convierte `no-trigger` en `with-trigger`.
- No tocar lógica de test, solo documenta upgrade path para cuando se quiera paralelizar (e2e.db por worker via `E2E_DB` env, ya soportado en `purchasable`).

## Data flow

- Sin cambio de flujo, solo documentación.

## Componentes

- `account-deletion.spec.ts:8` — ponytail con upgrade.
- `PONYTAIL-DEBT.md` — no-trigger 5→4.

## Testing strategy

- `grep -rn ponytail` → `account-deletion:8` ahora con `if parallel needed` → no-trigger reduce.
- `npx prettier --check` — file no prettificado antes, pero check debe pasar tras --write si se toca.

## Riesgos

- Ninguno. Solo comentario.

## Ponytail ceiling

- `// ponytail: serial — backdate mutates shared e2e.db; upgrade: per-test DB isolation or per-worker e2e.db if parallel needed` — techo explícito.

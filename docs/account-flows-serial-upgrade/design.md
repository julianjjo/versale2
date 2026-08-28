# Account flows serial — ponytail no-trigger

## Problema

`e2e/tests/account-flows.spec.ts:8` marcaba `// ponytail: serial — backdate mutates shared e2e.db` sin upgrade → `no-trigger` en ledger (4/16). Igual que `account-deletion:8` (ya fix 7→6), este `serial` es por `prismaForE2e()` muta `e2e.db` compartido via backdate; paralelo corrompería.

## Arquitectura

- Single file winner: `e2e/tests/account-flows.spec.ts`
- Actualizar ponytail a `// ponytail: serial — backdate mutates shared e2e.db; upgrade: per-test DB isolation or per-worker e2e.db if parallel needed` — convierte `no-trigger` en `with-trigger`.
- No tocar lógica, solo comentario.

## Data flow

- Sin cambio.

## Componentes

- `account-flows.spec.ts:8` — ponytail con upgrade.
- `PONYTAIL-DEBT.md` — no-trigger 4→3.

## Testing strategy

- `grep -rn ponytail` → `account-flows:8` ahora con upgrade → no-trigger reduce.
- `npx prettier --check` — file no prettificado, check tras --write.

## Riesgos

- Ninguno.

## Ponytail ceiling

- `// ponytail: serial — backdate mutates shared e2e.db; upgrade: per-test DB isolation or per-worker e2e.db if parallel needed` — techo explícito.

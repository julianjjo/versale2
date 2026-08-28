# Account flows resend — ponytail no-trigger

## Problema

`e2e/tests/account-flows.spec.ts:98` marcaba `// ponytail: resend no expone raw token — rotación probada vía invalidación del anterior` sin upgrade explícito → `no-trigger` en ledger (3/16). El test de `resend` verifica rotación vía `oldTok` invalidado, pero no documenta cuándo exponer token en claro.

## Arquitectura

- Single file winner: `e2e/tests/account-flows.spec.ts`
- Actualizar ponytail a `// ponytail: resend no expone raw token — rotación probada vía invalidación del anterior; upgrade: expose raw token only in test env if needed` — convierte `no-trigger` en `with-trigger`.
- No tocar lógica, solo comentario.

## Data flow

- Sin cambio.

## Componentes

- `account-flows.spec.ts:98` — ponytail con upgrade.
- `PONYTAIL-DEBT.md` — no-trigger 3→2.

## Testing strategy

- `grep -rn ponytail` → `account-flows:98` ahora con `if needed` → no-trigger reduce.
- `npx prettier --check` — file ya prettificado en iter 12, check debe pasar sin --write si solo cambia comentario.

## Riesgos

- Ninguno.

## Ponytail ceiling

- `// ponytail: resend no expone raw token — rotación probada vía invalidación del anterior; upgrade: expose raw token only in test env if needed` — techo explícito.

# Publish paused — ponytail no-trigger

## Problema

`e2e/tests/publish-moderation.spec.ts:301` marcaba `// ponytail: paused sigue contando (anti-bypass); liberar vía DELETE del más antiguo` sin `upgrade:` explícito → `no-trigger` en ledger (2/16, último no-trigger junto con otro). El test `g) límite 20 activas → 21st 429` verifica que `paused` sigue contando anti-bypass, con `liberar vía DELETE`.

## Arquitectura

- Single file winner: `e2e/tests/publish-moderation.spec.ts`
- Actualizar ponytail a `// ponytail: paused sigue contando (anti-bypass); liberar vía DELETE del más antiguo; upgrade: keep anti-bypass; change to exclude paused if product policy changes` — convierte `no-trigger` en `with-trigger`.
- No tocar lógica, solo comentario.

## Data flow

- Sin cambio.

## Componentes

- `publish-moderation.spec.ts:301` — ponytail con upgrade.
- `PONYTAIL-DEBT.md` — no-trigger 2→1 (o 1→0 si solo quedaba este).

## Testing strategy

- `grep -rn ponytail` → `publish-moderation:301` ahora con `; upgrade:` → no-trigger reduce.
- `npx prettier --check` — file ya prettificado, check debe pasar.

## Riesgos

- Ninguno.

## Ponytail ceiling

- `// ponytail: paused sigue contando (anti-bypass); liberar vía DELETE del más antiguo; upgrade: keep anti-bypass; change to exclude paused if product policy changes` — techo explícito.

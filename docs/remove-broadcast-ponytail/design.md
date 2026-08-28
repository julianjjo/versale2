# Remove BroadcastChannel ponytail — debt saldada

## Problema

`apps/web/src/app/sell/page.tsx:77` y `apps/web/src/lib/token.ts:4` marcan `// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip`. El `BroadcastChannel` fue eliminado en `fix/web-reportes-effect` y `fix/token-broadcast-cleanup`, y `storage+CustomEvent` cubre cross/same-tab. El ponytail documentaba techo, pero ledger lo cuenta como 2 de 16 markers con upgrade, y ya no es deuda activa — es documentación que puede vivir en `docs/` o en `PONYTAIL-DEBT.md` histórico, no como `ponytail:` en código (ruido).

## Arquitectura

- 2-file winner: `apps/web/src/app/sell/page.tsx` y `apps/web/src/lib/token.ts` — solo borrado de línea `// ponytail:...`, sin cambio de lógica.
- `PONYTAIL-DEBT.md` — remover 2 entradas `sell/page.tsx:77` y `token.ts:4`, 16→14 markers, 0 no-trigger se mantiene.

## Data flow

- Sin cambio.

## Componentes

- `sell/page.tsx:77` — borrar línea ponytail.
- `token.ts:4` — borrar línea ponytail.
- `PONYTAIL-DEBT.md` — 16→14.

## Testing strategy

- `grep -rn ponytail` → 14 (16-2).
- `npm run test:web` — sell/page y token no tienen test unitario directo, pero `test:web` 865 pass debe seguir.

## Riesgos

- Ninguno. Solo comentario.

## Ponytail ceiling

- Sin ponytail — deuda saldada, si se necesita instant cross-tab sin storage round-trip, reintroducir `BroadcastChannel` y ponytail.

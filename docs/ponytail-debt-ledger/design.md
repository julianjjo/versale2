# Ponytail Debt Ledger — diseño

## Problema

`grep -rnE '(#|//) ?ponytail:'` acumula deuda dispersa sin ledger central. Sin archivo persistido, un `ponytail:` sin upgrade path puede pudrirse ("later means never") y el loop no tiene artefacto inspectable para medir avance.

## Arquitectura

- Single file winner: `PONYTAIL-DEBT.md` en raíz (no `docs/`), generado desde `grep` filtrando `node_modules/.next/.git/.claude/.pi` — una fuente, cero runtime.
- Cada hit → fila `<file>:<line>, <what>. ceiling: <limit>. upgrade: <trigger>.`
- Agrupado por archivo, con categoría `no-trigger` si falta `, <upgrade>`.
- No cambia código fuente; solo añade ledger + este design doc.

## Data flow

- `grep --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=.claude --exclude-dir=.pi --exclude-dir=.pi-glla --exclude-dir=.worktrees -rnE '(#|//) ?ponytail:' apps e2e scripts | sort` → parse ceiling/upgrade por `,` split.
- Escribir `PONYTAIL-DEBT.md` con encabezado, tabla por archivo, footer `<N> markers, <M> with no trigger.` o `No ponytail: debt. Clean ledger.`

## Componentes

- `PONYTAIL-DEBT.md` (nuevo, raíz): ledger renderizado.
- `docs/ponytail-debt-ledger/design.md` (este archivo): contrato del ledger.
- Sin cambios en `apps/*`/`e2e/*`/`scripts/*` — solo lectura.

## Testing strategy

- `grep -rnE '(#|//) ?ponytail:' apps e2e scripts --exclude-dir=node_modules --exclude-dir=.next` debe seguir retornando mismos hits tras cambio (ledger no toca fuentes).
- `npm run test:api` y `npm run test:web` no regresan (0 archivos fuente tocados).
- Verificación manual: `cat PONYTAIL-DEBT.md` contiene `apps/api/src/cart/cart.service.ts:97` y `apps/web/src/lib/token.ts:4` y footer `12 markers` (o conteo real) con `no-trigger` flag donde aplique.

## Riesgos

- Ninguno runtime. Si ledger queda desactualizado, próximo `feat/ponytail-debt-ledger` lo regenera — YAGNI vs cron.

## Ponytail ceiling

- `// ponytail: ledger file, regenerate via grep if markers change; no watcher/cron until debt cadence >1/iteration` — techo explícito, upgrade a hook pre-commit si cadencia supera 1 deuda/iteración.

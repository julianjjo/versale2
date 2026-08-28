# CDP audit single session — ponytail no-trigger

## Problema

`e2e/utils/cdp-audit.ts:39` marcaba `// ponytail: single CDPSession per page` sin upgrade explícito → `no-trigger` en ledger (7/17). El helper crea 1 `CDPSession` por `page` via `page.context().newCDPSession(page)` y registra `Runtime/Log/Network/Performance`, pero no documenta cuándo hacer fan-out ni limpia `page.on('close')`.

## Arquitectura

- Single file winner: `e2e/utils/cdp-audit.ts`
- Actualizar ponytail a `// ponytail: single CDPSession per page; upgrade: per-page session is fine; fan-out or per-context session if CDP contention observed` — convierte `no-trigger` en `with-trigger` (tune o fan-out si contención).
- Añadir `page.once('close', () => detach().catch(()=>{}))` para asegurar `session.detach` si page cierra antes de `detach()` explícito, y `page.once('crash', ...)` similar — evita leak de CDP session en tests que cierran page temprano.

No tocar lógica de `collectMetrics` ni `getResult`.

## Data flow

- `attachCdpAudit(page)` → `newCDPSession(page)` → `session.on(...)` → `page.once('close', detach)` → `getResult`/`detach`.

## Componentes

- `cdp-audit.ts:39` — ponytail con upgrade + `page.once('close')`/`'crash'` handlers.
- `PONYTAIL-DEBT.md` — no-trigger 7→6.

## Testing strategy

- `npm run e2e -- cdp-audit` no tiene test unitario, pero `grep -rn ponytail` debe mostrar upgrade, y `e2e` no debe filtrar `__qaLongTasks` leak.
- Manual: `attachCdpAudit(page); await page.close();` no debe loggear `Target closed` error.

## Riesgos

- Ninguno. Solo añade `once('close')` idempotente; `detach()` ya es idempotente.

## Ponytail ceiling

- `// ponytail: single CDPSession per page; upgrade: fan-out or per-context session if CDP contention observed` — techo explícito.

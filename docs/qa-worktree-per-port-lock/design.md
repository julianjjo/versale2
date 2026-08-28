# QA worktree per-port lock — ponytail debt

## Problema

`scripts/qa-worktree.js:17` marcaba `// ponytail: global probe lock, per-port lock if parallel creation matters`. `freePort(start)` hace probe secuencial `for p in [start,start+200)` con `net.createServer().listen(p)` y `close`. Sin lock, dos invocaciones concurrentes `node qa-worktree.js a` y `node qa-worktree.js b` pueden ambas probar `3200` como libre y asignar mismo `apiPort`, colisión al crear worktrees en paralelo (CI local, dev con múltiples terminales). Ledger `PONYTAIL-DEBT.md` contaba este como 1 de 21 markers con upgrade explícito.

## Arquitectura

- Single file winner: `scripts/qa-worktree.js` — solo script dev, 0 runtime app.
- Reemplazar global probe con per-port lock usando `Map<number, Promise<boolean>>` + `async` queue por puerto: cada `probe(p)` se encola tras previo intento sobre mismo `p`, no bloquea puertos distintos.
- Mantener `for` loop secuencial por invocación (200 intentos), pero lock asegura que `listen(p)` check no racea con otro proceso que también probea `p` en paralelo (intra-proceso; inter-proceso queda best-effort via `listen` error, suficiente para YAGNI dev).

Alternativa descartada: file lock (`proper-lockfile`) o `flock` — dependencia nueva para script raro; `net` probe + in-process Map cubre caso real (dos `main` concurrentes en misma shell).

## Data flow

- `freePort(start)` → `for p` → `await withPortLock(p, () => probe(p))` → retorna primer `p` libre.
- `withPortLock(p, fn)` → `portLocks.get(p) ?? Promise.resolve()` → chain `prev.then(fn)` → guarda nuevo lock en Map, limpia al resolver.

## Componentes

- `scripts/qa-worktree.js:17` — comentario ponytail actualizado a `// per-port lock via Map, global probe no longer needed` o eliminado si debt saldada. Mantener 1 línea explicativa, no borrar contexto.
- Sin cambios en `apps/*`, `e2e/*`.

## Testing strategy

- Manual: `node scripts/qa-worktree.js --help` → usage ok
- `node -e "require('./scripts/qa-worktree.js')"` no crash (syntax)
- `grep -rn ponytail scripts/qa-worktree.js` → 0 o actualizado (no global probe)
- `npm run test:api` / `test:web` no afectados (script no importado)
- Simular paralelo: `Promise.all([freePort(3200), freePort(3200)])` debe retornar dos puertos distintos (3200 y 3201) no duplicados — verificar con pequeño harness si se añade test script.

## Riesgos

- Ninguno app. Script dev solo. Per-port Map no persiste inter-proceso (dos shells distintas) — colisión inter-proceso sigue posible pero rara; `listen` error fallback ya la detecta, solo añade retry. Si escala a CI paralelo real, upgrade a file lock.

## Ponytail ceiling

- `// per-port lock via in-process Map; file lock if inter-process parallel creation becomes common` — techo explícito, upgrade a `proper-lockfile` si worktrees se crean desde CI matrix paralelo.

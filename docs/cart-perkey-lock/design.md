# Cart per-key lock — ponytail debt

## Problema

`apps/api/src/cart/cart.service.ts:97` marcaba `// ponytail: naive P2002-only idempotency; no per-key lock, safe because CartItem @@unique[cartId,productId] enforces it`. `addItem` hace `upsert` sobre `@@unique[cartId,productId]` y en `catch P2002` re-lee `findUnique`. Con dos `POST /cart` concurrentes para mismo `cartId+productId`, ambos pueden entrar al `try`, uno gana `upsert`, el otro cae a `catch` y re-lee — funciona por unique, pero hace trabajo desperdiciado y dos round-trips a DB. Si en el futuro `addItem` hace más lógica (validar stock, reservar), el race ya no es solo idempotencia P2002.

## Arquitectura

- Single file winner: `apps/api/src/cart/cart.service.ts`
- Añadir `private readonly locks = new Map<string, Promise<unknown>>()` y helper `withPerKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T>` — encadena por clave `cartId:productId` via `prev.then(fn)` + silenced promise (mismo patrón `qa-worktree.js` per-port lock).
- `addItem`: envolver el `try { upsert } catch P2002 { findUnique }` dentro de `withPerKeyLock(`${cartId}:${productId}`, () => { ... })`. Mantener `catch P2002` como fallback inter-proceso (dos instancias API), pero intra-proceso ya serializa y evita el catch en caso común.

No tocar `updateItem/removeItem/clearCart` — no tienen race P2002 (update/delete sobre `id` único).

## Data flow

- `addItem(userId, productId, qty)` → `cartId = getOrCreateCartId` → `key = cartId:productId` → `withPerKeyLock(key, () => upsert || P2002→findUnique)` → retorna CartItem.
- `withPerKeyLock`: `prev = locks.get(key) || resolved`, `next = prev.then(fn)`, `silenced = next.catch(()=>{})`, `locks.set(key, silenced)`, `try {return await next} finally { if(locks.get(key)===silenced) delete }`.

## Componentes

- `CartService.locks` (Map) + `withPerKeyLock` (privado)
- `addItem` envuelto
- Comentario ponytail actualizado a `// per-key lock via in-process Map; P2002 fallback for inter-process` o eliminado si debt saldada.

## Testing strategy

- `npm run test:api` — cart service specs existentes (mock Prisma) siguen pasando; `withPerKeyLock` no cambia comportamiento observable, solo serializa.
- Manual: `Promise.all([addItem(uid,pid,1), addItem(uid,pid,1)])` con mock Prisma que delay 10ms debe retornar mismo CartItem sin throw P2002 (intra-proceso lock evita race).
- Verificación: `grep -rn ponytail apps/api/src/cart` → 0 o actualizado (no naive).

## Riesgos

- Ninguno DB. Lock es in-process, no distribuido — inter-process race sigue cayendo a P2002 fallback (seguro por unique). Si escala a múltiples réplicas API con alta contención, upgrade a Redis lock.

## Ponytail ceiling

- `// per-key lock via in-process Map; P2002 fallback for inter-process; Redis lock if multi-replica contention high` — techo explícito.

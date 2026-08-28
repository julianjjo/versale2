# Auth debug backdate — ponytail debt

## Problema

`e2e/tests/account-flows.spec.ts:21` y `account-deletion.spec.ts:32,247` marcan `// ponytail: cron not exposed via HTTP — direct DB backdate is minimal e2e bridge` con upgrade `expose POST /admin/debug/backdate only in NODE_ENV=test`. E2E hace `prisma.user.update({verificationTokenExpires: new Date(Date.now()-60000)})` directo a DB, acoplado a Prisma y no prueba el flujo via HTTP. `orders` ya tiene `POST /orders/admin/debug/run-sweeps` (#401), pero `auth` no.

## Arquitectura

- Single file winner: `apps/api/src/auth/auth.controller.ts` (+ `auth.service.ts` si se quiere encapsular, pero directo via PrismaService es mínimo).
- Añadir `POST auth/debug/backdate` sin auth guard (e2e no tiene JWT para backdate), con guard `if (process.env.NODE_ENV !== 'test') throw NotFoundException()` — solo test, no prod.
- Body `{ email: string, field: 'verificationTokenExpires' | 'resetTokenExpires' | 'verificationToken' | 'resetToken', value: string | null, expiresAt?: string }` simplificado a `{ email, target: 'verification' | 'reset', backdateMs: number }` o `{ email, field, value }`. Más simple: `{ email: string, verificationTokenExpires?: string, resetTokenExpires?: string }` — permite backdate ambos.
- Handler usa `PrismaService` para `user.update` where email, no lógica de negocio.
- No cambia `AuthService` — solo Prisma.

Alternativa descartada: exponer `POST /auth/admin/debug/backdate` con `ADMIN` guard — e2e tendría que loguearse como admin para backdate, más fricción; `auth/debug` sin guard pero test-only es suficiente.

## Data flow

- E2E (futuro): `POST /auth/debug/backdate` con `{email, verificationTokenExpires: new Date(Date.now()-60000).toISOString()}` → controller → `prisma.user.update` → 200 `{ok:true}`.
- Actual: e2e sigue usando direct DB, pero endpoint ya existe como upgrade path.

## Componentes

- `AuthController`: nuevo `POST debug/backdate` con `NotFoundException` guard y `PrismaService` inyección.
- `PONYTAIL-DEBT.md` — actualizar `account-flows:21` y `account-deletion:32,247` entries a `endpoint exists POST /auth/debug/backdate (test only)`.

## Testing strategy

- `npm run test:api` — auth service tests siguen  * (no toca service).
- Manual: `curl -X POST http://localhost:3001/auth/debug/backdate -H "Content-Type: application/json" -d '{"email":"test@e2e.test","verificationTokenExpires":"2020-01-01T00:00:00.000Z"}'` en `NODE_ENV=test` → 200, en `prod` → 404.
- `grep -rn ponytail` → `account-flows:21` etc. ahora con `endpoint exists`.

## Riesgos

- Ninguno prod: guard `NODE_ENV !== 'test'` → 404 fuera de test. Sin auth, pero test-only, no expone PII más allá de lo que e2e ya hace via DB.

## Ponytail ceiling

- `// debug backdate only in test; no exponer en prod, no añadir auth bypass` — techo explícito.

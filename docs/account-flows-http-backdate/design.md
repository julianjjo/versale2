# Account flows HTTP backdate — ponytail debt

## Problema

`e2e/tests/account-flows.spec.ts:21` helper `prismaForE2e()` y `verify expirado` test usan `prisma.user.update({verificationTokenExpires: past})` directo a DB porque `cron not exposed via HTTP`. Con `POST /auth/debug/backdate` (#414) ya existe upgrade HTTP, pero `verify expirado` aún usa DB directo.

## Arquitectura

- Single file winner: `e2e/tests/account-flows.spec.ts` (1 test, no helper global).
- Reemplazar `prismaForE2e().user.update` en `verify expirado` por `req.post(`${API_URL}/auth/debug/backdate`, {data: {email, verificationTokenExpires: pastISO}})`.
- Mantener `prismaForE2e` helper para otros usos (resend test que setea `verificationToken: hashToken(known)` — no cubierto por debug endpoint que solo backdatea expires).
- Actualizar `PONYTAIL-DEBT.md` — `account-flows:21` entry ahora `endpoint exists` ya, pero test ahora lo usa; ledger 16→15 si se considera que ese uso ya no es direct DB? Mantener 16 pero nota que 1 uso migrado a HTTP, o eliminar ponytail de ese test específico si se mueve a helper.

Simpler: Mantener helper ponytail, pero test ya no usa `prismaForE2e` para backdate, así que el ponytail del helper sigue (1 marker), pero el test ya no es direct DB. Ledger mantiene 16, pero nota que 1 test migrado.

Alternativa: Eliminar `prismaForE2e` usage de ese test y si no queda otro uso para backdate expires, helper ponytail sigue pero con nota `endpoint exists`.

## Data flow

- `verify expirado` → `POST /auth/debug/backdate` con `verificationTokenExpires: pastISO` → `prisma.user.update` vía controller → 200 → luego `POST /auth/verify-email` con token expirado → 400.

## Componentes

- `account-flows.spec.ts` `verify expirado` test — reemplaza prisma block por `req.post` debug.
- `PONYTAIL-DEBT.md` — actualizar `account-flows:21` entry a `endpoint exists, 1 test migrated to HTTP`.

## Testing strategy

- `npm run e2e -- account-flows` debe pasar con HTTP backdate (200) y luego 400 en verify.
- `grep -rn prismaForE2e` en `verify expirado` → 0, en otros tests → sigue.

## Riesgos

- Ninguno. Debug endpoint solo en test, sin auth, con NotFound fuera de test.

## Ponytail ceiling

- `prismaForE2e` helper ponytail sigue, pero con nota `endpoint exists POST /auth/debug/backdate`.

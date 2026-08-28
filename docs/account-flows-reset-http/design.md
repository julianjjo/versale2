# Account flows reset expirado HTTP — ponytail debt

## Problema

`e2e/tests/account-flows.spec.ts:220` test `reset expirado y token inválido → 400` aún usa `prismaForE2e().user.update({resetTokenExpires: past})` directo a DB, igual que `verify expirado` antes de #416. Con `POST /auth/debug/backdate` (#414) ya existe upgrade HTTP, pero este test aún usa DB directo.

## Arquitectura

- Single file winner: `e2e/tests/account-flows.spec.ts` (1 test, mismo patrón que #416).
- Reemplazar `prismaForE2e()` block por `req.post(`${API_URL}/auth/debug/backdate`, {data: {email, resetTokenExpires: pastISO}})`.
- Mantener `prismaForE2e` helper para otros usos (resend que setea `verificationToken` hash — no cubierto por debug endpoint que solo backdatea expires).
- Actualizar `PONYTAIL-DEBT.md` — `account-flows:21` entry ya dice endpoint exists, ahora `2 tests (verify + reset) now use HTTP` o mantener 16/0 pero nota que 2 tests migrados.

## Data flow

- `reset expirado` → `POST /auth/debug/backdate` con `resetTokenExpires: pastISO` → 200 → luego `POST /auth/reset-password` con token expirado → 400.

## Componentes

- `account-flows.spec.ts` `reset expirado` test — reemplaza prisma block por `req.post` debug.
- `PONYTAIL-DEBT.md` — actualizar `account-flows:21` entry a `2 tests migrated`.

## Testing strategy

- `npm run e2e -- account-flows` debe pasar con HTTP backdate.
- `grep -rn prismaForE2e` en `reset expirado` → 0.

## Riesgos

- Ninguno.

## Ponytail ceiling

- `prismaForE2e` helper sigue, pero con nota `2 tests migrated to HTTP`.

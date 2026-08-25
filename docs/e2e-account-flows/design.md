# E2E Account Flows — verify email + password recovery

Ponytail ultra: 1 spec, reuse helpers, no new deps, stdlib crypto.

## Architecture
- **API**: `POST /auth/signup` → hashed verificationToken (24h) + `AUTH_EXPOSE_VERIFICATION_TOKEN`; `POST /auth/verify-email`; `POST /auth/resend-verification` (JWT); `POST /auth/forgot-password` → hashed resetToken (1h, `AUTH_EXPOSE_RESET_TOKEN` + count>0); `POST /auth/reset-password` (atomic updateMany + tokenVersion++).
- **Web**: `/verify-email?token` (Verificar mi correo → ¡Correo verificado! / no es válido), `/forgot-password` (Enviar instrucciones → Si el correo existe…), `/reset-password?token` (Actualizar contraseña → se actualizó).
- **E2E harness**: `playwright.config.ts` webServer env exposes both tokens + `WEB_APP_URL=http://127.0.0.1:3100`; DB `apps/api/e2e.db` via `PrismaBetterSqlite3`.

## Data flow
Signup/raw→hash(sha256)→DB — verify matches hash+expiry; forgot updateMany simétrico (no timing oracle) — reset atomic consume; resend re-hashes new token, old invalidado.

## Components
- `e2e/tests/account-flows.spec.ts` (serial, 7 tests).
- Helpers: `hdr`, `login`, `uniqueEmail`, `prismaForE2e`, `hashToken` (crypto sha256).
- TTL sin cron: backdate directo `verificationTokenExpires`/`resetTokenExpires` vía Prisma. // ponytail: no HTTP trigger, direct DB backdate is minimal bridge

## Testing strategy
1. happy verify + replay 400 2. verify expired (backdated 400) 3. resend: success → old token invalidated (ponytail: resend no expone raw token, rotación probada via old-token 400) → verified 400 → sin auth 401 4. forgot→reset happy + reuse 400 + login old 401/new 200 5. reset expired+garbage 400 6. enumeration guard (200 sin leak) 7. UI (goto + fill + expect Spanish).
Reutiliza `createBuyer` pattern; espera `networkidle` solo en UI; serial para no pisar DB.

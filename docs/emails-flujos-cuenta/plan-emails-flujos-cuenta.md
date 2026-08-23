# Emails y flujos de cuenta (ítem 17)

> Hito 3, ítem 17 de `docs/todo-implementacion.md`.

## Decisión cerrada

La verificación de correo y la recuperación de contraseña envían **emails
transaccionales reales vía Brevo** (proveedor ya integrado en
`notifications/brevo.service.ts`), con enlaces a las páginas que el frontend
ya tiene (`/verify-email?token=…`, `/reset-password?token=…`). Ambos tokens
son **caducables y de un solo uso**, almacenados hasheados (SHA-256) — una
fuga de BD no entrega tokens vivos.

## Estado previo (ya existente en `main`)

- `POST /auth/signup` generaba `verificationToken` pero **nunca lo enviaba**
  (comentario obsoleto "No email provider is wired up yet" — Brevo ya estaba
  integrado para notificaciones).
- `POST /auth/forgot-password` generaba `resetToken` con TTL de 1 h, sin
  enviarlo; solo exponible con `AUTH_EXPOSE_RESET_TOKEN=true`.
- `resetPassword` ya validaba expiración atómicamente (`updateMany` con
  `resetTokenExpires: { gt: now }`), invalidaba JWTs por `tokenVersion`.
- Frontend: `/verify-email`, `/forgot-password`, `/reset-password` completos.

## Este cambio

1. **Expiración del token de verificación**: columna nueva
   `User.verificationTokenExpires` + migración. `verifyEmail` pasa a validarla
   en la misma escritura condicional (atómico, igual que reset). Sin ella, un
   token de verificación era válido para siempre.
2. **Envío real de emails** en `AuthService`:
   - signup → email de verificación con enlace
     `{WEB_APP_URL}/verify-email?token={raw}`.
   - forgotPassword → email de restablecimiento con enlace
     `{WEB_APP_URL}/reset-password?token={raw}`.
   - Nuevo `POST /auth/resend-verification` (JWT): re-emite token+expiración
     para la cuenta propia — sin él, un email perdido deja la cuenta sin
     verificar para siempre (el cambio de correo anula el token anterior).
3. **Resiliencia**: un fallo de Brevo NO rompe signup/forgotPassword
   (catch + log): crear cuenta o pedir reset no puede depender de un tercero.
   El usuario reintenta con resend-verification / forgot-password.
4. **Cambio de correo** (users.service): al resetear verificación también se
   limpia `verificationTokenExpires` (coherencia con el token nulado).

## Variables de entorno

| Variable | Uso | Default |
| --- | --- | --- |
| `BREVO_API_KEY` | Envío real; sin ella los emails se omiten (no-op seguro) | — |
| `BREVO_SENDER_EMAIL` | Remitente verificado en Brevo | — |
| `BREVO_SENDER_NAME` | Nombre visible | `Versale` |
| `WEB_APP_URL` | Base de los enlaces de verificación/reset | `http://localhost:3000` |
| `AUTH_EXPOSE_VERIFICATION_TOKEN` | Dev/e2e: devuelve el token crudo en la respuesta | off |
| `AUTH_EXPOSE_RESET_TOKEN` | Dev/e2e: devuelve el token crudo en la respuesta | off |

Fail-closed: los flags `AUTH_EXPOSE_*` exigen opt-in explícito; nunca se
infiere de `NODE_ENV`.

## Seguridad

- Tokens opacos de 256 bits, guardados como SHA-256, consumo único por
  escritura condicional (sin check-then-act).
- Expiración validada dentro del mismo `updateMany`: replay y expirado caen
  en el mismo `count === 0`.
- `forgotPassword` no revela si el correo existe (mensaje único).
- Reset bumpa `tokenVersion` → invalida JWTs previos.

## Pruebas (contrato Done-when: simular envío y expiración)

`auth.service.spec.ts`:

- **Envío simulado** (mock de `BrevoService.sendEmail`):
  - signup envía email al destinatario nuevo con asunto de verificación y
    enlace que contiene el token crudo (nunca el hash).
  - forgotPassword envía email con enlace de reset que contiene el token
    crudo.
  - resend-verification re-emite y envía.
  - Un fallo de Brevo no rechaza signup/forgotPassword.
- **Expiración simulada**:
  - verifyEmail consulta con `verificationTokenExpires: { gt: <now> }` y
    trata `count === 0` (expirado/consumido/desconocido) con el mismo error
    genérico.
  - signup/resend estampan `verificationTokenExpires` a futuro.

## Fuera de alcance

Plantillas HTML ricas, colas/reintentos de envío, rate-limit específico por
correo (el throttle global por IP ya cubre el endpoint), verificación SMS.

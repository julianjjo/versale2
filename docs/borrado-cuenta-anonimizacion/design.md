# Diseño — Borrado de cuenta con anonimización

Roadmap: `docs/funcionalidades-propuestas.md` → sección "Con tracción" → **Borrado de cuenta con anonimización**. Es el único ítem pendiente del roadmap tras los ítems 1–17: hoy `/privacidad` promete eliminación por mailto y el único borrado es admin-only con `user.delete` directo que **falla por FK** ante cualquier usuario con actividad (`users.service.ts` `remove()`, handler P2003).

## Objetivo

Autoserborrado de cuenta (`DELETE /users/me`) con limpieza de PII dentro de una `$transaction`, preservando los registros transaccionales (órdenes) y el contenido comunitario (reseñas, preguntas, reportes) atribuido a "Usuario eliminado". El admin `DELETE /users/:id` pasa por el mismo camino de anonimización, arreglando el borrado roto.

## Decisiones cerradas

| Decisión | Elección | Motivo |
|---|---|---|
| Soft vs hard delete | **Soft-delete**: `User.deletedAt DateTime?` + sobrescritura de PII en la misma transacción | Las órdenes históricas necesitan un `userId` vivo (FK RESTRICT); reutilizar la fila evita migrar FKs a null |
| Re-registro con el mismo correo | Sí: el email se anonimiza a `eliminado-{uuid}@anonymized.invalid` | Libera el `email @unique`; el usuario puede volver a crear su cuenta |
| Contenido comunitario | Reseñas/preguntas/reportes **se conservan**; votos útiles, favoritos, notificaciones y carrito **se borran** | El contenido es historial del marketplace; votos/favoritos son datos personales sin valor comunitario |
| Productos activos | `AVAILABLE → WITHDRAWN` vía `updateMany({ where: { sellerId, status } })` | Reutiliza el enum de 1.1; desaparecen del catálogo |
| Direcciones de envío | Se conservan hasta 30 días tras `deliveredAt` (ventana de disputa de 2.2); `CANCELLED`/`REFUNDED` se redactan al instante; cron horario completa el resto | No romper disputas/entregas en curso; mismo plazo que la expiración de disputas |
| Confirmación | `currentPassword` obligatorio (patrón self-service existente en `update()`); último ADMIN bloqueado | Evita takeover por sesión robada; no dejar el marketplace sin moderación |
| Sesiones | `tokenVersion { increment: 1 }` + chequeo `deletedAt` en login y `JwtStrategy.validate` | Invalida todos los JWT; defensa en profundidad |
| Rol del anonimizado | El `user.update` de la anonimización baja `role → USER`; el conteo de admins vivos filtra `deletedAt: null` y corre DESPUÉS de la primera escritura (lock de SQLite) dentro de la transacción | Un admin borrado no puede seguir contando como admin (zombi) ni dos admins pueden autoborrarse a la vez por TOCTOU |
| PII en texto libre | Reseñas/preguntas/reportes escritos por el usuario se conservan íntegros (sin ventana de redacción) — decisión aceptada: su contenido es público desde el origen y moderable por admin | Difiere de shippingAddress, que era dato privado de la transacción |

## Cambios

### API (`apps/api`)

1. **Schema + migración** (`20260823XXXXXX_account_deletion_anonymization`):
   - `User.deletedAt DateTime?`
   - `Order.shippingAddressRedactedAt DateTime?` — marca explícita e indexable de redacción (SQLite no permite filtrar contenido Json).
2. **DTO** `delete-account.dto.ts`: `{ currentPassword: string }` (`@IsString() @MinLength(1)`), mensaje en español.
3. **UsersService**:
   - `deleteOwnAccount(id, dto)`: verifica contraseña (403 si falla), bloquea último admin (403), ejecuta `anonymizeUserInTransaction`.
   - `anonymizeUserInTransaction(tx, userId)` (privado, compartido):
     1. `product.updateMany` → WITHDRAWN
     2. `cartItem.deleteMany` + `cart.deleteMany`
     3. `favorite.deleteMany`, `reviewHelpfulVote.deleteMany`, `notification.deleteMany`
     4. `order.updateMany`: redacción inmediata de direcciones ya prescribidas (`status ∈ {CANCELLED, REFUNDED}` ∨ `deliveredAt ≤ now−30d`) → `shippingAddress = { eliminada: '…' }` + `shippingAddressRedactedAt`
     5. `user.update`: `deletedAt=now`, `name='Usuario eliminado'`, email anonimizado, password aleatoria (bcrypt de 32 bytes random), tokens nulos, `isVerified=false`, `tokenVersion+1`
   - `remove()` (admin): reutiliza `anonymizeUserInTransaction` (conserva guardias de auto-borrado y último admin; elimina el handler P2003 que ya no aplica). Tanto `update()` como `remove()` rechazan con 404 filas ya anonimizadas, y `findAll()` las excluye del panel salvo `?deleted=true|all`.
   - Cron `@Interval(1h) redactAddressesForDeletedAccounts()`: mismo `where` de redacción para usuarios con `deletedAt ≠ null`; público para tests.
4. **Auth hardening**:
   - `login()`/`validateUser()`: `user.deletedAt ≠ null` → rechazo genérico (el bcrypt ya se pagó, sin oracle de timing).
   - `forgotPassword()`: `where: { email, deletedAt: null }` (simétrico, sin oracle).
   - `jwt.strategy.validate()`: `deletedAt ≠ null` → 401.
5. **Controller**: `@Delete('me')` antes de la ruta admin `:id`.

### Web (`apps/web`)

1. `/profile`: Card "Zona de peligro" — explicación de consecuencias, input de contraseña y botón que abre `Modal` de confirmación accesible (existente) → `api.delete('/users/me', { data: { currentPassword } })` → `logout()` → redirect `/login?reason=account_deleted`.
2. `/login`: banner para `reason=account_deleted` ("Tu cuenta se eliminó correctamente").
3. `/privacidad`: reemplazar el texto "próximamente" por el mecanismo real (Perfil → Eliminar mi cuenta), manteniendo mailto como canal alterno.

## Riesgos revisados (multiángulo)

- **Seguridad**: contraseña exigida; tokenVersion invalida sesiones de todas las pestañas; reset/verify tokens nulos impiden revivir la cuenta; mensajes genéricos anti-enumeración intactos; email anonimizado no colisiona (uuid).
- **Rendimiento**: todas las escrituras son `updateMany/deleteMany` por `userId/sellerId` indexados; transacción única corta; el cron procesa lotes pequeños (usuarios borrados son raros).
- **Integridad**: órdenes PENDING/PAID/SHIPPED/DISPUTED conservan dirección hasta resolución + 30d; reseñas/preguntas/reportes quedan atribuidos a "Usuario eliminado" sin romper FKs.
- **Tests**: specs nuevos para DTO, servicio (feliz, contraseña mala, último admin, efectos colaterales), auth (login/forgot/jwt con borrados), cron; ajuste de los specs existentes de `remove()`; web: render de zona de peligro, validación, llamada API y logout.

## Verificación

- `npm run test:api` y `npm run test:web` en verde desde la rama.
- E2E no requiere cambios (la feature no toca flujos existentes de compra/venta).

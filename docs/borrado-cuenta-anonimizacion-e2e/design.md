# Borrado de cuenta E2E — diseño minimal

## Arquitectura
API NestJS + Prisma SQLite (better-sqlite3) + Next.js. `DELETE /users/me` → `UsersService.anonymizeUserInTransaction()` (7 tablas). Web: `profile/DangerZone` + `Modal` confirmación → `api.delete('/users/me')` → `logout()` → `/login?reason=account_deleted`.

## Flujo de datos
`DELETE /users/me {currentPassword}` → bcrypt 403/200 → `$transaction`: user→(deletedAt,name,email,role USER,pwd random,tokenVersion+1), product AVAILABLE→WITHDRAWN, cartItem/cart/favorite/helpfulVote/notification deleteMany, order shippingAddress redactable (CANCELLED/REFUNDED o deliveredAt≤now-30d → REDACTED). `redactAddressesForDeletedAccounts()` cron hourly para resto.

## Componentes
- DangerZone (profile/page.tsx): input "Confirma tu contraseña" + botón "Eliminar mi cuenta" → modal "¿Seguro...?" → "Sí, eliminar definitivamente" → logout + redirect.
- Login banner `reason=account_deleted`.
- JwtAuthGuard: deletedAt 401 + tokenVersion mismatch 401; login/forgot-password bloquean deletedAt.

## Matriz de pruebas (8 serial)
|#|Escenario|Asserts clave|
|1|DangerZone UI happy + API variant|wrong pwd 403 alert, correct → /login?reason=account_deleted, localStorage cleared, bell gone, API DELETE 200|
|2|Token invalidation|old GET /users/me 401, login 401, forgot 200 sin token|
|3|Email liberado|POST /auth/signup mismo email 201|
|4|Producto WITHDRAWN|public search 0, admin ve WITHDRAWN, seller mine 401|
|5|Cascada deletes|favorites/cart/vote/notification 0 vía prisma, GET /favorites 401|
|6|Redacción 30d|order DELIVERED <30d no redactada, backdate 31d → REDACTED (ponytail: cron no HTTP, backdate vía Prisma)|
|7|Last-admin guard|DELETE self 403 "propia cuenta", DELETE último admin 403 "último administrador", GET /users aún activo|
|8|Wrong pwd guard|DELETE /users/me wrong pwd 403 "actual es incorrecta"|

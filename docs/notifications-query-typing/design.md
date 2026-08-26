# Notifications query typing — eliminar `any` en controller/service

## Problema

`notifications.controller.ts:21` expone `@Query() query: any` y lo pasa a `notifications.service.findAll(req.user.id, query)` que espera `Record<string,unknown>`. ESLint `no-unsafe-argument` (any→Record). Continuación del piloto `favorites-query-typing` (#167); quedan 14 warnings.

## Solución (ponytail ultra)

- `notifications.controller.ts`: `@Query() query: unknown`
- `notifications.service.ts`: `findAll(userId, query: unknown)` con guard `const q = isRecord(query) ? query : {};` y destructuring `const {page,limit,unreadOnly}=q`. Mantiene default `{}` y filtra `unreadOnly` igual.

## Verificación

- `npx eslint src/notifications/*` → 0 errors en esos 2 archivos
- `lint:ci` → 13 warnings (14→13), 0 errors
- `npm run test:api` → 727 passed

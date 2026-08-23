# Auditoría de sobre-ingeniería (ponytail-audit) — Limpieza repo-wide

## Objetivo

Aplicar los 11 hallazgos del audit de sobre-ingeniería: borrar código muerto e
infraestructura especulativa, eliminar dependencias que la plataforma ya cubre,
y encoger duplicación interna. Cero cambios de comportamiento.

## Alcance

### Eliminaciones (delete)
1. Infraestructura de benchmarks/CodSpeed: `apps/api/bench/`, `apps/web/bench/`,
   `vitest.bench.config.mts` ×2, `.github/workflows/codspeed.yml`, scripts
   `bench*` en los 3 package.json, dep `@codspeed/vitest-plugin` ×2.
2. Artefactos puntuales commiteados: `.impeccable/critique/*.md` (14 reportes),
   `.diagram-design`.
3. Método muerto `AuthService.validateUser()` (sin llamador; `login()` lo cubre)
   + su spec.
4. Export muerto `statusVariantFor()` en `apps/web/src/lib/order-status.ts`.

### Dependencias fuera (native / stdlib)
5. Stack Passport (`passport`, `passport-jwt`, `@nestjs/passport`,
   `jwt.strategy.ts`) → guard propio que verifica con `JwtService.verify()`.
   Mismo payload, mismos errores 401, sin la capa Passport.
6. `axios` → wrapper mínimo sobre `fetch` en `apps/web/src/lib/api.ts` con la
   misma superficie (`api.get/post/... → { data }`, errores con
   `.response.status/.data`, interceptores de auth y 401).
7. `@nestjs/config` (nunca importado; dotenv carga el .env) y
   `source-map-support` (nunca importado).

### Encogimientos (shrink)
8. `Input`/`Textarea`/`Select` comparten lógica label/hint/error/id triplicada →
   componente interno `Field`.
9. DTOs bulk ×4 casi idénticos → clase base `BulkIdsDto` + extensiones.

### Config
10. Glob `"packages/*"` en package.json raíz: cero paquetes → se elimina.
11. `Trim` decorator y demás utils se conservan (todos tienen llamadores).

## Riesgos y mitigaciones

- **Cambio de axios a fetch** es el de mayor superficie. Mitigación: el wrapper
  replica exactamente la forma usada por los ~20 call sites (`{ data }`,
  `error.response.status/data`) y se reescriben los tests que mockeaban axios
  para ejercitar el wrapper real.
- **Passport → guard propio**: los guards (`JwtAuthGuard`,
  `OptionalJwtAuthGuard`) mantienen nombre y semántica; `jwt.strategy.spec.ts`
  se sustituye por spec del nuevo guard.

## Estrategia de pruebas

- `npm run test:api`, `npm run test:web` (unit/integration completos).
- Lint + build de ambos apps.
- `npm run e2e` completo (Playwright, ports 3100/3101).
- Nuevos/ajustados: spec del fetch-wrapper (auth header, 401 logout, errores
  blob/json), spec del JwtAuthGuard propio.

## Verificación final

PR → CI verde → merge a `main` → build estable en main.

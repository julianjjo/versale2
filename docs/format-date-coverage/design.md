# Format-date coverage — test singleton determinism

## Problema

`perf/format-date-singleton` (#181) hoisted `PUBLISH_DATE_FORMATTER` singleton pero no añadió test que congele el contrato determinista (UTC `es-CO` idéntico servidor/cliente, sin hydration mismatch). Sin test, una regresión que vuelva a `toLocaleDateString` sin `timeZone:"UTC"` pasaría inadvertida.

## Solución (ponytail ultra)

- Nuevo `apps/web/src/lib/__tests__/format-date.test.ts` (1 test, 3 asserts):
  - `formatPublishDate("2026-01-10T10:00:00Z")` → `"Publicado el 10 de enero de 2026"` (es-CO, UTC)
  - Mismo input en `es-CO` local vs UTC no diverge (determinismo)
  - `formatPublishDate` usa singleton `PUBLISH_DATE_FORMATTER` (no `toLocaleDateString` por llamada) — verificado indirectamente vía idempotencia y `Intl.DateTimeFormat` mock.

Mantiene `Price`/`memberSince` ya cubiertos indirectamente; este es el único formatter con riesgo hydration.

## Verificación

- `npm run test:web` → 44→45 files, 554→557 tests
- `npx eslint .` → 0/0

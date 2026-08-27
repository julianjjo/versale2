# Price singleton coverage — test COP_FORMATTER

## Problema

`perf/price-formatter-singleton` (#179) hoisted `COP_FORMATTER` singleton pero no añadió test que congele el contrato `es-CO` COP sin decimales. Sin test, una regresión a `toLocaleString` con `maximumFractionDigits:2` o `currency:"USD"` pasaría inadvertida.

## Solución

- Nuevo `apps/web/src/components/ui/__tests__/price.test.tsx` (2 tests):
  - Render `Price` con `value={45000}` → texto contiene `45.000` y `$` (es-CO COP)
  - Render `Price` con `value={0}` → `"$ 0"` (edge)

Usa `@testing-library/react` como `format-date.test.tsx`.

## Verificación

- `npm run test:web` → 46/45? 46 files, 559/557 (+1 file +2 tests)
- `npx eslint` → 0/0

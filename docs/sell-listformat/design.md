# Sell ListFormat — Intl.ListFormat singleton

## Problema

`apps/web/src/app/sell/page.tsx:286` une `missingAltPositions` con `join(", ").replace(/, ([^,]*)$/, " y $1")` manual — ponytail marcó `manual "y" for es conjunction; Intl.ListFormat if locale rules grow`. Funciona para `es` pero no respeta reglas de lista de `Intl` (Oxford, locale).

## Solución (ponytail ultra)

- Hoist `const ALT_LIST_FORMATTER = new Intl.ListFormat("es", { style:"long", type:"conjunction" })` fuera del componente (singleton).
- `Faltan las descripciones de las fotos ${ALT_LIST_FORMATTER.format(missingAltPositions.map(String))}.`

Mantiene salida idéntica para `es` (`1, 2 y 3`), usa API estándar.

## Verificación

- `npx eslint` web → 0/0
- `npm run test:web` → 45/45 557/557 (sell page no tiene test específico para este mensaje, pero no rompe)

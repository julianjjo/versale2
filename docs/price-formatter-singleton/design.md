# Price formatter singleton — evitar Intl alloc por render

## Problema

`apps/web/src/components/ui/index.tsx: Price` usa `value.toLocaleString("es-CO", {style:"currency",...})` por render. En catálogo con 20 tarjetas × 2 precios + paginación, crea 40+ `Intl.NumberFormat` efímeros por render — ponytail marcó `// ponytail: Price via toLocaleString; Intl.NumberFormat singleton if render hot (>100 Prices/page)`.

## Solución (ponytail ultra)

- Hoist `const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 })` fuera del componente (singleton por módulo).
- `Price` usa `COP_FORMATTER.format(value)` en lugar de `toLocaleString`.

Mantiene salida idéntica (`es-CO` COP sin decimales), una alloc vs N por render. No cambia API, no afecta tests (formato idéntico).

## Verificación

- `npx eslint .` → 0/0
- `npm run test:web` → 44/44 554/554 (Price render idéntico)
- Manual: `COP_FORMATTER.format(45000) === (45000).toLocaleString("es-CO", ...)` true

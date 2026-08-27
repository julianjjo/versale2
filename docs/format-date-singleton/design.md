# Format-date singleton — evitar Intl alloc por render

## Problema

`apps/web/src/lib/format-date.ts: formatPublishDate` usa `new Date(createdAt).toLocaleDateString("es-CO", {timeZone:"UTC"})` por render. En catálogo con 20 tarjetas + mis-productos, crea 20+ `Intl.DateTimeFormat` efímeros por render — ponytail marcó `singleton if pin needed`. Mismo patrón que `Price` (#179) ya resuelto con `COP_FORMATTER`.

## Solución (ponytail ultra)

- Hoist `const PUBLISH_DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", { day:"numeric", month:"long", year:"numeric", timeZone:"UTC" })` fuera de función (singleton por módulo).
- `formatPublishDate` usa `PUBLISH_DATE_FORMATTER.format(new Date(createdAt))` vs `toLocaleDateString`.

Mantiene salida idéntica (`es-CO` UTC) y determinista (mismo string servidor/cliente, sin hydration mismatch), 1 alloc vs N por render.

## Verificación

- `npx eslint .` (web) → 0/0
- `npm run test:web` → 44/44 554/554 (formato idéntico)
- Manual: `new Date("2026-01-10T10:00:00Z").toLocaleDateString(...) === PUBLISH_DATE_FORMATTER.format(new Date(...))` true

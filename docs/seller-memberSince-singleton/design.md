# Seller memberSince singleton — evitar Intl alloc por render

## Problema

`apps/web/src/components/products/seller-profile-content.tsx` usa `new Date(data.memberSince).toLocaleDateString("es-CO", {year:"numeric", month:"long", timeZone:"UTC"})` por render de perfil. En vendedor con muchas visitas, crea `Intl.DateTimeFormat` efímero por render — ponytail marcó `singleton if pinning needed`. Mismo patrón que `Price` (#179) y `formatPublishDate` (#181) ya resueltos.

## Solución (ponytail ultra)

- Hoist `const MEMBER_SINCE_FORMATTER = new Intl.DateTimeFormat("es-CO", { year:"numeric", month:"long", timeZone:"UTC" })` fuera del componente (singleton por módulo, UTC determinista igual que `toLocaleDateString` con `timeZone:"UTC"`).
- Componente usa `MEMBER_SINCE_FORMATTER.format(new Date(data.memberSince))`.

Mantiene salida idéntica (`es-CO` mes/año UTC), 1 alloc vs N.

## Verificación

- `npx eslint .` → 0/0
- `npm run test:web` → 44/44 554/554
- `npm run test:api` → 728

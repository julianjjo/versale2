# Seller memberSince coverage — test singleton determinism

## Problema

`perf/seller-memberSince-singleton` (#183) hoisted `MEMBER_SINCE_FORMATTER` singleton pero no añadió test que congele el contrato `es-CO` `month:long` UTC determinista. Sin test, una regresión a `toLocaleDateString` sin `timeZone` reintroduciría hydration mismatch en perfil de vendedor.

## Solución

- Nuevo `apps/web/src/components/products/__tests__/seller-profile-content.test.tsx` (1 test):
  - Render `SellerProfileContent` con `initialProfile` `memberSince: "2022-03-15T10:00:00Z"` → `Miembro desde marzo de 2022` (es-CO, UTC, month long)
  - Verifica `activeListings` texto.

Usa `TestProviders` y `initialProfile` para evitar fetch, como `product-detail` tests.

## Verificación

- `npm run test:web` → 46→47 files, 557→558 tests
- `npx eslint` → 0/0

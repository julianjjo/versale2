# Precio sugerido — design (ponytail ultra)

Objetivo: orientar al vendedor con un precio medio por categoría + condición.

API: `GET /products/suggested-price?category=&condition=` → `{ suggestedPrice:number, sampleSize:number } | { suggestedPrice:null }`. Requiere ambos; usa `canonicalCategory` y `PUBLICLY_VISIBLE`.

Lógica service `getSuggestedPrice(category, condition)`:
1. `aggregate { _avg:{price}, _count }` where `{ ...PUBLICLY_VISIBLE, category: canonicalCategory(c), condition }`. Si count>=3 → `Math.round(avg)`.
2. Si <3, fallback `aggregate` solo por categoría. Si >=3 → devuelve ese avg.
3. Si sigue <3 → `{ suggestedPrice:null }`.
Single aggregate cada intento, sin tabla/índice nuevo. // ponytail: simple average, median/IQR if outliers matter.

Threshold `SUGGESTED_PRICE_MIN_SAMPLE=3` (doc propone 5; 3 evita datos vacíos iniciales).

Frontend `sell/page.tsx`: `useQuery` enabled cuando categoría+condición elegidas; hint bajo precio: `Precio sugerido: $X (basado en N publicaciones)` en español; no bloquea ni auto-rellena.

Tests: service 3 casos (hit exacto, fallback categoría, muestra insuficiente) + web hint render.

Verificación: `npm run test:api` y `test:web` pasan.

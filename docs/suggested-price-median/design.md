# Suggested price median — robusto a outliers

## Problema

`products.service.ts: getSuggestedPrice` usa `aggregate _avg` (media simple) — ponytail marcó `simple average, median/IQR if outliers matter`. Una prenda de lujo a $500k entre 3 muestras de $50k sesga la media a $200k, sugiriendo precio inflado.

## Solución (ponytail ultra)

- Cambia `aggregate` → `findMany({select:{price:true}})` para exact y fallback
- Helper `median(values:number[]):number` con sort y `mid` (par promedia dos centrales)
- Si `exactPrices.length >=3` → median exact, else fallback median, else null
- Mantiene `Math.round` y `sampleSize` (ahora `prices.length`)

## Verificación

- Actualiza `products.service.spec.ts` mocks de `aggregate` → `findMany` con `price`
- `npm run test:api` → 729+1? (729→729, mismo, solo cambia impl)
- `npx eslint` → 0/0

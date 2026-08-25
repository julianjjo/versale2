# Búsqueda y filtros case-insensitive — Design

## Objetivo
Que `search`, `brand` y `category` sean case-insensitive: "jeans" = "Jeans" = "JEANS".

## Hallazgo que define el diseño
El datasource es **SQLite** (`apps/api/prisma/schema.prisma`). Se verificó contra
una base real, no mockeada:

| Operador | Comportamiento en SQLite |
|---|---|
| `contains` (→ SQL `LIKE`) | **ya es case-insensitive** para ASCII |
| `equals` (→ SQL `=`) | case-**sensitive** |
| `mode: 'insensitive'` | **lanza error**: `Unknown argument \`mode\`` |

`mode: 'insensitive'` es una feature exclusiva de **PostgreSQL y MongoDB**. En
SQLite el query engine la rechaza, así que usarla no haría la búsqueda
case-insensitive: haría que **cada** búsqueda devolviera 500. Los tests unitarios
mockean Prisma, así que ese fallo pasaría verde en CI y explotaría solo en runtime.

## Arquitectura
- `search` y `brand`: **sin cambios**. `contains` ya ignora mayúsculas en SQLite.
- `category`: único gap real. Se normaliza el valor entrante contra la lista
  cerrada `PRODUCT_CATEGORIES` antes de consultar, vía `canonicalCategory()`.

## Data flow
`query.category` → `firstValue()` → `canonicalCategory()` (fold contra la lista
cerrada) → `where.category = { equals: <canónico> }` → `findMany` + `count`.

## Por qué normalizar en vez de tocar SQL
La DTO ya valida escrituras con `@IsIn(PRODUCT_CATEGORIES)`, así que lo guardado
siempre sale de esa lista cerrada. Doblar el filtro a la ortografía canónica es
un lookup puro: sin raw SQL, sin `COLLATE NOCASE`, sin migración, sin deps.

Valores fuera de la lista (filas legacy como "Jackets", anteriores a la lista
cerrada) pasan intactos: siguen matcheando su propia ortografía en vez de
filtrar a vacío.

## No cambia
`minPrice/maxPrice/size/condition`, índices, paginación, `findAllMine` (reusa
`searchTextWhere`), y el gap conocido de `getRelatedProducts`.

## Testing
Mock de `PrismaService`, verificando el `where` que recibe `findMany`:
- category "chaquetas" → `{ equals: 'Chaquetas' }`
- category "JEANS" → `{ equals: 'Jeans' }`
- category "Jackets" (legacy) → pasa intacto
- guard de regresión: el `where` nunca contiene `insensitive`

## Limitación conocida
`LIKE` en SQLite sólo pliega mayúsculas **ASCII**. Un término que difiera únicamente
en un carácter acentuado (p. ej. `É` vs `é`) no matchea. Fuera de alcance: requiere
`COLLATE`/ICU o normalizar en escritura.

# Búsqueda y filtros case-insensitive — Design

## Objetivo
Que `search`, `brand`, `category` sean case-insensitive: "jeans"="Jeans"="JEANS".

## Arquitectura
- Un solo punto de cambio: `ProductsService` (`findAll` + `findAllMine` vía `searchTextWhere`).
- Prisma `mode: 'insensitive'` en `contains`/`equals`. En SQLite mapea a `COLLATE NOCASE` — sin raw SQL ni `LOWER()`.

## Data flow
`query.search/brand/category` → `firstValue()` → `where.OR/where.brand/where.category` con `mode: insensitive` → SQLite COLLATE NOCASE → `findMany`+`count`.

## Cambios
- `searchTextWhere()`: `contains: term, mode: 'insensitive'` (4 campos).
- `findAll`: `brand: { contains: brand, mode: insensitive }`, `category: { equals: category, mode: insensitive }`.

## No cambia
`minPrice/maxPrice/size/condition`, índices, paginación, `findAllMine` (reusa `searchTextWhere`).

## Testing
Mock `PrismaService`. Verificar `where` recibido por `findMany`:
- search "jeans" matchea "Jeans" (contains + insensitive)
- brand "nike" matchea "Nike"
- category "chaquetas" matchea "Chaquetas"

## Ponytail rationale
- Reusa `mode: insensitive` nativo de Prisma — 6 LOC, sin deps, sin `LOWER()` manual.
- Índices `contains` ya no se usan de todos modos (substring scan); `NOCASE` no empeora perf.
- Simplificación: no normalizar en escritura; case-fold solo en lectura.

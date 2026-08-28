# Products top_rated cap — observability ponytail

## Problema

`apps/api/src/products/products.service.ts:66` y `:343` marcan `MAX_TOP_RATED_SCAN=1000` cap y `O(n) in-memory, cheap for n<10k; materialize averageRating+index if catalog >10k`. El cap trunca `total` a 1000 y `take 1000` silencia el desborde — si catálogo supera 1k, paginación top_rated pierde productos top globales sin señal operativa. Ledger 18 markers, 2 son este cap/O(n) con upgrade a materialización.

## Arquitectura

- Single file winner: `apps/api/src/products/products.service.ts`
- Añadir `this.logger.warn` cuando `total > MAX_TOP_RATED_SCAN` dentro de rama `isTopRated`, con métricas `total`, `cap`, `where` keys (sin PII). Mantener cap y O(n) — solo observabilidad, no materialización aún (YAGNI hasta 1k sustained).
- Actualizar ponytail comments a `// ponytail: cap 1000, warn on truncation; materialize averageRating+index if >1k sustained` y `// ponytail: O(n) in-memory, cheap for n<10k, warned; materialize if >10k` — hacen cap observable, reducen rot risk.
- No migrar DB, no índice nuevo.

Alternativa descartada: materializar `averageRating` column + index ahora — 1 migración + backfill + triggers para 20 listings activos hoy, YAGNI.

## Data flow

- `findAll(query, isTopRated=true)` → `count` y `findMany take 1000` → si `total>1000` → `logger.warn({total, cap, truncated: total-cap})` → `effectiveTotal = min(total, cap)` → sort in-memory → slice.

## Componentes

- `ProductsService.logger.warn` (ya existe) en `isTopRated` block.
- `PONYTAIL-DEBT.md` — actualizar cap/O(n) entries a `warned`, mantener 18 markers (cap sigue, pero ahora observable; no reduce count, pero avanza target).

## Testing strategy

- `npm run test:api -- src/products` — mocks de `findMany`/`count` deben seguir pasando; nuevo `logger.warn` no afecta retorno.
- Manual: mock `total=1500` → `effectiveTotal 1000` + warn logged.
- `grep -rn ponytail` → cap comment ahora incluye `warn`.

## Riesgos

- Ninguno. Solo log, no cambia `effectiveTotal` ni paginación. Si log spamea (top_rated popular), upgrade a rate-limit o métrica.

## Ponytail ceiling

- `// ponytail: cap 1000, warn on truncation; materialize averageRating+index if >1k sustained` — techo explícito, materializar si warn se dispara sostenido.

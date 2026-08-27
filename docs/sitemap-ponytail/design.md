# Sitemap ponytail — debt cleared

## Problema

`sitemap.ts:31` `// ponytail: sitemap caps 500, paginate/cursor if catalog >500` marcaba deuda de cap sin paginación. `fix/web-reportes-effect` (#176) y `fix/sitemap-ponytail` previo ya implementaron `slice(0, SITEMAP_MAX_URLS)` y `PAGE_SIZE=100` loop con `take 500`, pero el comentario ponytail quedó.

## Solución

- Eliminar `// ponytail: sitemap caps 500, paginate/cursor if catalog >500` (deuda saldada).
- Mantener `SITEMAP_MAX_URLS=500` y `slice` como contrato.

## Verificación

- `npx eslint` web → 0/0
- `npm run test:web` 46/555, `test:api` 730

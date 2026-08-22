# SEO técnico mínimo (ítem 11)

> Hito 1, ítem 11 de `docs/todo-implementacion.md`. Pre-lanzamiento: el
> catálogo es el inventario; si los crawlers no lo leen, no existe.

## Implementación

- **`generateMetadata` dinámico** (`products/[id]/page.tsx`): title
  `{título} — Versale`, description truncada a 160 del texto real del
  listing, y `openGraph` con la primera foto (url + alt del ítem 4).
  Comparte `lookupProduct` con el render — Next deduplica el fetch por
  request. Listing inexistente: `Producto no encontrado — Versale` (el 404
  HTTP ya lo daba la página).
- **Metadata estática** en las páginas públicas: catálogo
  (`Explorar marketplace — Versale`), ayuda, contacto, términos, privacidad
  (las tres últimas ya la tenían). El root layout mantiene la metadata
  general del sitio.
- **`sitemap.ts`**: rutas estáticas (home, catálogo, legales, ayuda) + un
  `<loc>` por producto **públicamente visible** — `PUBLICLY_VISIBLE` del API
  ya filtra `isApproved + AVAILABLE + !pausedAt`, que es exactamente el
  "solo aprobados" del roadmap. `force-dynamic`: el catálogo cambia con cada
  aprobación y el build de CI corre sin API (el try/catch degrada a rutas
  estáticas, nunca un 500). Paginado con tope de 5×100 para que un catálogo
  enorme no cuelgue la ruta.
- **`robots.ts`**: permite `/`; bloquea superficies privadas sin valor SEO
  (admin, cart, orders, favoritos, mis-productos, mis-ventas, profile, sell,
  login, signup) y declara `Sitemap: {SITE_URL}/sitemap.xml`.
- **`lib/site.ts`**: `SITE_URL` (`NEXT_PUBLIC_SITE_URL`, fallback
  `http://localhost:3000` para dev/E2E) y `API_URL` legible desde rutas de
  servidor.

## Pruebas (E2E `seo.spec.ts`)

- Detalle de producto: `<title>` contiene el título real del listing,
  `meta[name=description]` presente y `og:title` con el título.
- `/sitemap.xml`: 200, `<urlset`, ≥3 `<loc>` (rutas estáticas + aprobados)
  y al menos un `<loc>.../products/{id}</loc>`.
- `/robots.txt`: 200, línea `Sitemap: …/sitemap.xml`, `Disallow: /admin` y
  `/cart`.

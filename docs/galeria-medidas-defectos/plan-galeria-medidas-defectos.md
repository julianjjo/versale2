# Galería multi-foto, medidas y defectos (ítem 4)

> Hito 1, ítem 4 de `docs/todo-implementacion.md`. Decisión cerrada del roadmap:
> `images` migra a `[{ url, alt }]` en una sola migración, máximo exacto **6**,
> URLs solo del bucket propio de uploads (Cloudflare R2).

## Problema

Hoy `images?: string[]` no tiene ningún validador: acepta URLs externas libres
(hotlink, phishing, o foto que luego cambia), no exige texto alternativo y la
galería usa el título del producto como `alt` para todas las fotos — inútil
para un lector de pantallas cuando hay varias. Además el comprador escéptico
no tiene dónde ver medidas ni defectos declarados.

## Diseño

### Dato (`apps/api/prisma/schema.prisma`)

- `images Json?` conserva su columna pero pasa a contener `[{ url, alt }]`.
- Nuevas columnas `measurements String?` y `defects String?` (texto libre
  curado por el vendedor, con límite de longitud a nivel DTO).
- Migración única `product_gallery_measurements_defects`:
  1. Backfill determinista: toda fila cuyo array contenga strings se reescribe
     a `json_object('url', v, 'alt', '')` — el `alt` vacío es honesto (el dato
     no existía) y obliga al vendedor a completarlo en su próxima edición.
  2. `ALTER TABLE` agrega las dos columnas nuevas.

### DTO (`create-product.dto.ts`; `update` hereda por `PartialType`)

- `images?: ProductImageDto[]` con:
  - `@ArrayMaxSize(6)` — máximo exacto cerrado por auditoría.
  - `@ValidateNested({ each })` + `@Type(() => ProductImageDto)`.
  - `url`: https + host permitido = host de `R2_PUBLIC_BASE_URL`. El validador
    lee la env al momento de validar (los tests la fijan). Si la env no está
    definida solo se aceptan hosts locales http(s) (dev sin R2 configurado).
  - `alt`: obligatorio, no vacío, ≤150 caracteres.
- `measurements?` / `defects?`: strings opcionales ≤1000 caracteres.

### UI (`apps/web`)

- `/sell`: input de texto alternativo **obligatorio** por foto subida (el
  submit bloquea si falta), campos "Medidas" y "Defectos", tope sube a 6 y el
  upload hace tandas de a 5 (límite real de `FilesInterceptor('files', 5)`).
- `ProductGallery`: usa el `alt` de cada foto; botón "Ampliar imagen" que abre
  el `Modal` accesible existente (`role="dialog"`, `aria-modal`, foco atrapado,
  cierre con Esc y devolución de foco) mostrando la imagen ampliada.
- Consumidores de `images[0]` (carrito, órdenes, mis-productos, admin, browser)
  pasan a `images[0]?.url`.

### Desviación documentada del roadmap

El roadmap sugería `next/image` + `remotePatterns`. Se mantiene `<img>`: el
dominio del bucket es runtime (`R2_PUBLIC_BASE_URL`) y `next/image` lo exige a
build/config; el beneficio de conversión buscado aquí es zoom + alt, no
optimización de imágenes. Queda como mejora posterior si se fija el dominio.

## Pruebas

- API: DTO rechaza >6 imágenes, URL fuera del bucket R2 y `alt` vacío;
  acepta el shape nuevo completo.
- Web: zoom accesible (botón con nombre accesible → diálogo con `role="dialog"`
  y `aria-modal`, cierre con Esc); galería anuncia y usa el `alt` por foto.

## Pipeline

Rama `pr/galeria-medidas-defectos` desde `main` actualizado → PR → CI verde →
squash merge. Auditor detachado verifica el contrato sobre `main` limpia.

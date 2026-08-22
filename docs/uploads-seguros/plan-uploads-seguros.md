# Uploads seguros y Rate Limiting (ítem 9)

> Hito 1, ítem 9 de `docs/todo-implementacion.md` / decisiones cerradas 1.11 +
> 1.12 de `docs/funcionalidades-propuestas.md`.

## Verificación real de MIME (magic bytes)

El `Content-Type` declarado por el cliente es controlado por el atacante: un
`.html` o `.svg` (XSS almacenado) pasaba el whitelist declarando
`image/png`. Ahora:

- `apps/api/src/uploads/magic-bytes.ts`: sniffer de firmas — JPEG (`FF D8
  FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), WEBP (`RIFF....WEBP`). Sin
  dependencias externas (~40 líneas; `file-type` es ESM-only en versiones
  actuales).
- `UploadsService.validateFiles()`: además del whitelist del mimetype
  declarado, los bytes deben sniffar al mismo MIME; si no,
  `400 «El contenido de … no corresponde a una imagen … válida»`.
- **La extensión almacenada se deriva del MIME validado** (los bytes lo
  probaron), nunca del nombre original: `payload.html` que declara PNG se
  guarda como `.png` con bytes PNG. `extname(originalname)` ya no participa.

## Tope de publicaciones activas

- `ProductsService.create()`: máximo **20** publicaciones activas por
  vendedor (`MAX_ACTIVE_LISTINGS_PER_SELLER`, número duro anti-abuso).
- El conteo es sobre `status = AVAILABLE`, que **incluye las pausadas**
  (`pausedAt` solo oculta) — no hay bypass vía pausar-y-publicar.
  `SOLD`/`WITHDRAWN` son historial y no cuentan.
- Al superar el tope: **HTTP 429** con mensaje en español indicando retirar o
  eliminar una publicación.

## Rate limiting (ya existente, 1.11)

`@nestjs/throttler` global en `app.module.ts` + límites estrictos en auth.
Este ítem agrega el tope de publicaciones como segundo cinturón contra
spam de catálogo.

## Pruebas

- `uploads.service.spec.ts`:
  - 'rejects a forged mime whose magic bytes say otherwise' — HTML declarado
    `image/png` → 400.
  - 'rejects a truncated file shorter than any magic signature' → 400.
  - 'accepts real image bytes regardless of the filename' — bytes reales con
    nombre hostil pasan.
  - 'derives the stored extension from the validated mime' — la key queda en
    `.png`, nunca `.html`.
- `products.service.spec.ts`:
  - 'rejects the 21st active listing with HTTP 429'.
  - 'counts paused listings toward the active cap' — verifica el filtro del
    conteo (`AVAILABLE`) y el 429.
  - 'allows a new listing when the seller is under the cap'.

# Funcionalidades propuestas — Versale (venta de ropa usada)

> **HISTÓRICO v5 — documento cerrado.** El negocio núcleo (hitos 1–3) está implementado y verificado en `main`; el resto quedó explícitamente fuera de alcance o supeditado a tracción real (>500 productos aprobados o usuarios activos). La documentación de diseño por funcionalidad fue eliminada del repositorio (ciclo limpieza-documentación): el código y sus tests son la única fuente de verdad. No abrir nuevas propuestas salvo que cambie una premisa verificada del código o llegue tracción real.

> Alcance: solo funcionalidades directamente ligadas al marketplace de ropa usada C2C.
> Nada genérico: cada ítem debe servir para que una transacción de ropa usada ocurra con confianza.
>
> **Revisión v4**: criticado por 11 agentes independientes con ángulos distintos (ver registro al final). Se eliminaron o aplazaron las ideas que no sobrevivieron; las afirmaciones sobre código existente están marcadas como verificadas contra los archivos reales.

## Estado actual (verificado en código)

- Auth con login/JWT. ⚠️ Corrección verificada: `verificationToken`/`resetToken`/`isVerified` existen **solo como columnas del schema** — ningún endpoint ni servicio implementa verificación de email ni recuperación de contraseña, y nada consume `isVerified`. No hay mailer.
- `apps/api/src/products/products.service.ts` **ya implementa** (verificado): búsqueda por texto (`search` sobre title/description/brand/category), filtros `minPrice`/`maxPrice`/`size`/`brand`/`condition`, paginación `page`/`limit`. Falta solo exponer `category` como filtro dedicado (hoy solo está dentro del OR del buscador).
- Checkout ya usa `$transaction` (`orders.service.ts`, línea ~64) pero **no valida disponibilidad** — ahí vive la validación de stock único.
- Productos con categoría/marca/talla/condición, `images Json?`, moderación admin (`isApproved`).
- Carrito, órdenes con estados (PENDING → PAID → SHIPPED → DELIVERED / CANCELLED — hoy PAID es manual/simulado).
- Reseñas: ya bloquean auto-reseña (vendedor no se reseña) y duplicados por usuario/producto a nivel app (`reviews.service.ts`); **sin** elegibilidad por entrega (cualquier usuario puede reseñar cualquier producto).
- Postura de seguridad (verificada): `@IsPositive()` ya rechaza precios ≤ 0 en los DTOs de producto; **no existe rate-limiting en toda la API** (verificado: ni código ni dependencia `@nestjs/throttler`); los uploads tienen allowlist MIME + 5MB pero la extensión del archivo se deriva del `originalname` declarado por el cliente.
- SEO (verificado): sin `metadata`/`generateMetadata` en detalle ni listado de productos, sin `sitemap.ts`, sin `robots.ts` — cero adquisición orgánica hoy.
- Cuenta (verificado): no existe autoserborrado de cuenta; `DELETE /users/:id` es solo-ADMIN y hace `user.delete` directo (`users.service.ts` ~69) — sobre un usuario con productos/órdenes/resenas fallaría por restricciones de FK. La dirección de envío vive como `Json` dentro de cada Order.

## Estado actual v5 (verificado 2026-08-24)

> **V4 archivado como referencia histórica** ? el snapshot v4 se conserva intacto arriba. Lo que sigue refleja el estado real del código en `main` al 2026-08-24 y no contradice `AGENTS.md:59` (evolucion documentada, no reescritura).

- **Auth + verificación email / recuperación:** `isVerified`, `verificationToken`, `resetToken` implementados con flujos reales; `Brevo` (`apps/api/src/notifications/brevo.service.ts`) envía emails transaccionales (no-op sin API key, script de prueba `apps/api/scripts/brevo-test.mjs`).
- **Rate limiting:** `@nestjs/throttler` activo en `app.module.ts` (`ThrottlerModule` + `ThrottlerGuard`), límite base 300 req/min (definido en módulo, con overrides por ruta donde aplica).
- **Uploads:** validación por magic-bytes (`apps/api/src/uploads/magic-bytes.ts` + `sniffImageMime`), limite 20 publicaciones activas por vendedor, 5 archivos por request, extensión derivada del MIME verificado (no del `originalname`), dominio R2 en `remotePatterns`.
- **SEO:** `sitemap.ts` (solo productos `isApproved: true` + páginas legales, `force-dynamic` con fallback estático) y `robots.ts` (`disallow: /admin,/cart,/orders,etc.`) implementados en `apps/web/src/app/`.
- **Borrado / anonimización:** `User.deletedAt` + `@@index([deletedAt])`, soft-delete transaccional (`users.service.ts`), anonimizacion de PII, ordenes conservadas, reseñas a "Usuario eliminado", productos activos -> `WITHDRAWN`, cron diario con `@nestjs/schedule` (~30 dias tras `DELIVERED`).
- **Índices Prisma:** ya no cero ? `Product` (`isApproved,status,pausedAt,createdAt/price/category/size/condition`, `isApproved,rejectedAt`, `sellerId`), `Order` (`status,paidAt/disputeExpiresAt/createdAt`, `userId,createdAt`), `OrderItem` (`productId`), `Review` (`@@unique([userId,productId])`), `Favorite`, `Report`, `Question`, etc.
- **Catálogo / rutas web:** `mis-productos`, `mis-ventas`, `favoritos`, `vendedores/[id]`, `verify-email`, `forgot-password`, `reset-password`, `ayuda`, `contacto`, `terminos`, `privacidad`, `cookies`, `envios`.

---

## Hito 1 — Núcleo transaccional (el negocio funciona)

| # | Funcionalidad | Descripción | Esfuerzo |
|---|---|---|---|
| 1.1 | **Stock único** | Enum `ProductStatus { AVAILABLE, SOLD, WITHDRAWN }`. Ropa usada = prenda única. Al pagar la orden, marcar vendido dentro de la misma `$transaction` existente usando `updateMany({ where: { id, status: 'AVAILABLE' } })` y verificar `count === 1` (evita TOCTOU/doble venta). Forzar `quantity = 1` en CartItem/OrderItem. | M |
| 1.2 | **Validación al pagar** | Es el mismo cambio que 1.1: si un ítem dejó de estar AVAILABLE, **falla el checkout completo** con mensaje indicando el producto vendido (decisión cerrada: sin órdenes parciales). No implementar dos veces. | — |
| 1.3 | **"Mis publicaciones"** | Listado y gestión de los productos propios (`where sellerId`). El ownership en update/remove **ya está verificado** (`products.service.ts` ~128/~148); falta la vista/endpoints de listado propio y bloquear edición de productos SOLD. Incluir **banda de estado de moderación** por producto ("En revisión" / "Publicado" / "Rechazado: motivo") derivada de `isApproved`/`rejectionReason` — feedback mínimo al vendedor sin panel de métricas; si hay rechazo, enlace a editar. Regla de estados cerrada: Rechazado = `!isApproved && rejectionReason != null`; En revisión = `!isApproved && rejectionReason == null`. Sin esto el vendedor ocasional publica una vez y abandona. | M |
| 1.4 | **Galería multi-foto + zoom** | Validar DTO: array máximo **6** y **solo URLs del bucket propio de uploads** (hoy `images?: string[]` — verificado: sin ningún validador en `create-product.dto.ts` — acepta URLs externas libres → hotlink, phishing o foto que luego cambia). Implementar con `next/image` (`fill` + `sizes`) dentro del contenedor `aspect-[3/4]` fijo que exige `design.md` (cero layout shift); dominio del bucket en `remotePatterns`; thumbnails = misma imagen con `sizes` pequeño (sin sharp). El zoom real debe ser un botón "Ampliar imagen" que abre un diálogo accesible (`role="dialog"`, `aria-modal`, foco atrapado, cierre con Esc), no solo el hover CSS decorativo. El comprador escéptico decide con fotos: una sola imagen mata la conversión. Decisión cerrada por auditoría: `images` migra a `[{ url, alt }]` en una sola migración, máximo exacto **6**. ⚠️ Alinear con el endpoint real: `/uploads/images` acepta máximo **5 archivos por request** (`FilesInterceptor('files', 5)`) — o se baja el DTO a 5, o el form hace dos tandas. Storage verificado: Cloudflare R2, key con prefijo fijo `products/`, URL pública de `R2_PUBLIC_BASE_URL` (ese es el dominio para `remotePatterns`). | S–M |
| 1.5 | **Medidas reales + defectos declarados** | Campo opcional `measurements String?` con convención "pecho/largo/hombro" en el placeholder, y campo de estado detallado de imperfecciones (manchas, roturas; "sin defectos" explícito vale más que silencio). Exigir una descripción por foto en el formulario de venta para el `alt`: en ropa usada describe el estado real ("Jean Levi's 501, despeluzado en rodilla izquierda") y es además SEO — hoy las cards usan `alt={product.title}` genérico. Ataca la duda #1 del usado: "¿me quedará?" y "¿qué me ocultan?". Defectos como `defects String?` texto libre opcional con placeholder "Sin defectos". | S |
| 1.6 | **Reseña solo tras entrega** | Lo que falta: elegibilidad por OrderItem con orden DELIVERED del usuario para ese producto (auto-reseña y duplicados ya se bloquean a nivel app; agregar `@@unique([userId, productId])` solo como endurecimiento contra carreras). Hoy las reseñas son inflables → señal falsa de confianza. | S |
| 1.7 | **Moderación con fotos + motivo de rechazo** | Grilla admin con imágenes (`loading="lazy" decoding="async"` — CSS reescala pero igual descarga los bytes completos) y `rejectionReason String?` visible al vendedor. Rechazo silencioso = vendedor perdido. No mezclar este ciclo de vida con el enum de stock (1.1). Política decidida (auditoría): **todo manual** mientras sea 1 dev; revisar auto-aprobación cuando exista verificación de email real (bloque 3.2). `rejectionReason` se crea en la migración inicial de 1.1, no en 1.7. | S–M |
| 1.8 | **Confirmación post-checkout** | Redirect a `/orders/[id]` — la página ya existe (verificado en `apps/web/src/app/orders/[id]`), solo falta el redirect post-checkout y mostrar número/estado. Ansiedad post-compra real; costo mínimo. | S |
| 1.9 | **Páginas legales reales** | ⚠️ Verificado: el footer enlaza "Privacidad"/"Cookies"/"Términos"/"Envíos" y todos apuntan a `/login` como placeholder (`apps/web/src/components/layout/footer.tsx`; también hay enlaces decorativos tipo "Pedir bolsa", "Calculadora de ganancias" → `/products`). Crear `/terminos` y `/privacidad` con contenido breve (se piden email, nombre y dirección de envío), corregir hrefs, y agregar checkbox de aceptación de términos + edad mínima (**18 años**) en `signup` (verificado: `apps/web/src/app/signup/page.tsx` no tiene ni checkbox ni aviso de edad). `/privacidad` debe declarar **cómo pedir la eliminación de cuenta** (mailto vía `CONTACT_EMAIL`, ver 1.10) — prometer en texto algo que no existe es peor que no prometer; el mecanismo automatizado va a "Con tracción". Imprescindible pre-lanzamiento. | S–M |
| 1.10 | **Canal mínimo de contacto** | Mailto simple en la página de producto/ayuda (no el modelo Report completo), destino en variable de entorno `CONTACT_EMAIL` con placeholder visible si falta. Sin él, contenido problemático no tiene vía de denuncia. Cuesta casi nada. | S |
| 1.11 | **Rate limiting global** | `@nestjs/throttler` (ej. 10 req/min global) + límites estrictos en crear producto / reseñar / upload / auth, y tope de publicaciones activas por vendedor (~20). Hoy no hay ningún límite; imprescindible antes del Hito 3 (y barato ahora). | S–M |
| 1.12 | **Validación real de uploads** | Verificar magic bytes con `file-type` y derivar la extensión del MIME validado, nunca del nombre original (~5 líneas; confirmado en `uploads.service.ts`: `ext = extname(originalname)` tiene prioridad sobre el MIME validado). Un `.html` pasa hoy si el cliente declara `image/png`. | S |
| 1.13 | **Filtro `category` en el catálogo** | Hueco huérfano detectado por auditoría: el estado actual verifica que falta exponer `category` como filtro dedicado pero ningún ítem lo recogía. ⚠️ Verificado además que en `/sell` la categoría es **texto libre** (placeholder "Ej. Chaquetas, Camisetas"), no un selector — sin normalizarla primero, el filtro será inservible por variantes y errores de tipeo. Orden: convertir categoría a **selector con opciones fijas compartidas frontend/DTO** (primer cambio, bloqueante del filtro) → luego exponer como filtro en DTO + UI. Lista cerrada decidida: Camisetas, Camisas, Pantalones, Jeans, Chaquetas, Abrigos, Vestidos, Faldas, Suéteres, Shorts, Calzado, Accesorios, Otros; backfill de lo existente a "Otros" cuando no calce. | S–M |
| 1.14 | **SEO técnico mínimo** | Sin metadata/sitemap/robots el inventario es invisible en Google (verificado en Estado actual). `generateMetadata` en `/products/[id]` (title = "{título} – {marca} {talla} · Versale", description ~155 caracteres, OpenGraph con `images[0]`); metadata estática en listado y home; `sitemap.ts` solo con productos `isApproved: true` + páginas legales de 1.9; `robots.ts` excluyendo `/admin`, `/orders`, `/sell`, `/cart`. Al **final del Hito 1**: depende de 1.9 (legales en sitemap) y URLs de imagen estables (1.4), y el catálogo acumula indexación temprana. | M |
| 1.15 | **Fricción de publicación (flujo móvil menor a 10 min)** | Borrador automático en `localStorage` al escribir en `/sell` (verificado: hoy no hay ninguna persistencia de borrador — un fallo de upload/moderación pierde todo) + botón "Publicar otro igual" en 1.3 que precarga título/categoría/talla de un producto propio. Reutiliza el flujo existente, cero endpoints nuevos. | S |

## Hito 2 — Confianza transaccional (hueco detectado: faltaba entero)

| # | Funcionalidad | Descripción | Esfuerzo |
|---|---|---|---|
| 2.1 | **Política de devoluciones escrita** | Simple y visible: p. ej. 48h si la prenda no coincide con la descripción/fotos. Es la garantía que cierra la venta dudosa; sin ella ninguna otra feature genera confianza completa. La devolución se ejecuta a través del mecanismo de disputa de 2.2 (misma ventana de 48h desde DELIVERED, misma resolución por admin): 2.1 es la política visible al comprador, 2.2 su implementación. No se construyen dos mecanismos. | S |
| 2.2 | **Estados DISPUTED / REFUNDED + mecánica del dinero** | Extender `OrderStatus` (verificado: hoy sin DISPUTED/REFUNDED). Reglas con plazos fijados: pago PAID sin envío en **7 días** → cancelación automática + reembolso (vendedor desaparecido); disputa con reglas anti-abuso — **una sola por orden**, fotos obligatorias del comprador, ventana límite (**48h desde DELIVERED**) y resolución final por admin, con expiración a los **30 días** como último recurso → reembolso al comprador. Única excepción automática que mueve dinero: el timeout de envío; toda disputa abierta requiere resolución humana. Los timeouts requieren `@nestjs/schedule` (verificado: no existe ningún cron en la API). El reembolso en esta fase es solo transición de estado (PAID sigue simulado). Definir quién retiene el dinero entre PAID y DELIVERED antes del Hito 3. Las fotos de la disputa pueden reutilizar `/uploads/images` (ya accesible a cualquier usuario autenticado — verificado); decidir si van bajo otro prefijo que no sea `products/`. | M |
| 2.3 | **Envío con responsabilidad definida** | Hoy existe SHIPPED pero nadie definió el flujo, y `updateOrderStatus` es **solo ADMIN** (`orders.controller.ts`, `@Roles(ADMIN)`) — decisión cerrada por auditoría: **abrir la transición a SHIPPED al vendedor dueño de los productos de la orden** (admin conserva las demás transiciones), **envío pagado por el comprador e incluido en el precio**, sin número de tracking en esta fase. Para C2C es parte de la transacción, no detalle técnico. | S–M |
| 2.4 | **Señales de confianza visibles** | "Vendido por @usuario" en card y detalle, y fecha de publicación visible ("publicado hace 3 meses" genera dudas honestas — mejor mostrarla). ⚠️ El badge "email verificado" se pospone a 3.2: sin mailer real promete más de lo que garantiza. Nota: las reseñas no son señal anti-fraude confiable hasta que existan cobros reales (fricción contra cuentas Sybil). | S |

## Hito 3 — Cobro real (después de 1 y 2)

| # | Funcionalidad | Descripción | Esfuerzo |
|---|---|---|---|
| 3.1 | **Pasarela de pagos** | Default cerrado por auditoría: empezar por **sandbox de MercadoPago**, webhooks vía túnel (ngrok) en dev, idempotencia por `paymentId` externo único en Order. La elección final de proveedor/país es decisión del dueño (requiere cuenta KYC y credenciales que solo él puede proveer). **No antes**: cobrar dinero real sin stock único ni reseñas verificadas amplifica el daño. Requiere cláusula de responsabilidad en T&C y micro-texto en ficha de producto ("prenda usada vendida por particular; Versale es intermediario"). | L |
| 3.2 | **Emails transaccionales + flujos de verificación/recuperación reales** | ⚠️ Corrige la v1: **no hay mailer y los flujos de verificación/recuperación no existen** (solo columnas huérfanas en schema). Integración Brevo ya implementada (`apps/api/src/notifications/brevo.service.ts`, solo email; no-op sin API key) con script de prueba `apps/api/scripts/brevo-test.mjs`. Falta: implementar los flujos sobre las columnas existentes y notificar pago/envío/entrega cuando hay dinero de por medio. Antes de eso, el login por contraseña basta. | M |
| 3.3 | **Decisión de monetización declarada** | Default cerrado por auditoría: **0% comisión durante validación, envío a cargo del comprador** (incluido en el precio, ver 2.3). Documentado aquí; revisar al activar cobros reales (3.1). | S |

## Con tracción (revisar cuando haya >500 productos aprobados o usuarios activos)

- **Favoritos/wishlist** — modelo `Favorite(userId, productId, @@unique)`; mostrar productos SOLD como "ya vendido", no ocultarlos. Retención legítima en prendas únicas, pero prematuro antes de tener compradores recurrentes.
- **Reputación de vendedor** (rating medio agregado, on-demand sin columnas denormalizadas) — necesita decenas de ventas por vendedor para significar algo. Mientras tanto, las señales de 2.4 ("vendido por", fecha de publicación) cubren; el badge verificado llega con el mailer real (3.2).
- **Página pública de vendedor** — `/products?sellerId=` (filtrar `isApproved: true`); verificado que hoy el servicio NO acepta `sellerId` como filtro (solo en creación y ownership), así que es un parámetro nuevo en el `where` existente; feature de marketplace maduro.
- **Productos relacionados** — query simple por categoría; con poco inventario devuelve ruido.
- **Reporte de producto** — modelo Report trivial pero imán de abuso sin tráfico; requiere anti-spam mínimo (unique usuario/producto).
- **Precio sugerido** — `aggregate _avg` por categoría/condición; ruidoso y engañoso con pocos datos (mostrar solo si N ≥ umbral).
- **Métricas admin** — `count` + `groupBy`; no vende una sola prenda. Vuelve cuando haya usuarios reales preguntando por números.
- **Borrado de cuenta con anonimización** — soft-delete (`deletedAt`) + limpieza de PII dentro de `$transaction`: órdenes históricas se conservan como registro transaccional, reseñas quedan a nombre de "Usuario eliminado", productos activos pasan a WITHDRAWN (reutiliza el enum de 1.1), direcciones anonimizadas ~30 días tras DELIVERED (misma ventana que la expiración de disputas de 2.2). Hoy el único borrado es admin-only con `user.delete` directo que fallaría por FK (verificado en Estado actual). Activarlo al primer usuario real que lo pida.

## Eliminadas de la v1 (y por qué)

- ~~Emails "reutilizando el mailer de verificación"~~ — el mailer no existe; premisa falsa (y los flujos de verificación/recuperación tampoco: ver 3.2).
- ~~Métricas admin como feature del MVP~~ — cero impacto en comprador/vendedor.

---

## Prioridad resumida

1. **Hito 1** (stock único primero; 1.4–1.5 son las de mayor impacto por esfuerzo en confianza; 1.9, 1.10 y 1.12 bloquean el lanzamiento legal/seguro; 1.11 basta antes del Hito 3 aunque conviene temprano; 1.13–1.15 acompañan dentro del hito según el orden de implementación).
2. **Hito 2** (barato, cierra el círculo de confianza pre-cobro; sus reglas de disputa son imprescindibles antes del Hito 3).
3. **Hito 3** (pagos + emails juntos, monetización decidida).

## Notas técnicas clave (de la crítica de factibilidad)

- La doble venta se evita con `updateMany` condicional + verificación de `count` dentro de la `$transaction` que ya existe — nunca con `findMany` previo (TOCTOU).
- LIKE en SQLite es case-insensitive solo ASCII; aceptable para español, no agregar FTS5 (el `contains` no usa índices de todos modos — correcto a ~5k productos).
- **Índices Prisma: el schema tiene cero índices** — agregarlos en la misma migración de 1.1: `@@index([isApproved, createdAt(sort: Desc)])` en Product (listado público), `@@index([sellerId])` (mis publicaciones, 1.3), `@@index([productId])` en OrderItem (elegibilidad de reseña 1.6 y lookup de stock); el `@@unique([userId, productId])` de Review sirve de índice gratis.
- Ratings promedio: calcular on-demand (`_avg`, `_count`, `groupBy`); no denormalizar en columnas.
- Orden de dependencias: 1.1 → 1.3/1.6 → ratings; 3.1 ⟷ 3.2 van juntos.
- Verificado que no existe ningún SDK de pagos en `apps/api` — el estado "PAID" es solo un valor de enum asignable por admin.
- `condition` se guarda como enum en inglés (`'New','Like New','Good','Fair'`, verificado en DTO): cualquier selector o filtro nuevo debe mapear esos valores a etiquetas en español (regla de copy del repo) sin cambiar los valores almacenados.

### Notas frontend (rendimiento/a11y)

- Listado: usar `placeholderData` (React Query v5) para que paginar no desmonte la grilla (hoy `isLoading` borra todo → salto de layout); tras cambiar de página, mover el foco al encabezado del listado y anunciar "Página X de Y" con `aria-live="polite"`. La búsqueda aplica al enviar el formulario: sin debounce necesario aún (si algún día pasa a búsqueda en vivo, ≥300ms).
- Paginación: hoy renderiza TODAS las páginas (`Array.from({ length: meta.pages })`) — con ~5.000 productos serían ~420 botones. Ventana ±2 alrededor de la actual, o solo ‹/›.
- Estados de carga: `aria-busy` en el contenedor, texto en `role="status"`, skeletons con el mismo aspect-ratio 3/4 (coherente con `design.md`) en vez de spinner centrado.
- Bug estructural existente que amplificarán las señales de 2.4: hay un botón interactivo anidado dentro del `<Link>` de la card (HTML inválido; lectores de pantalla lo anuncian mal). Sacarlo como hermano posicionado (overlay) o convertir la card en un solo link con acciones separadas.
- Reglas transversales de `design.md`: foco visible 2px en todo elemento nuevo; terracotta <14px requiere el shade oscuro; checkbox legal (1.9) con patrón `useId()`→`htmlFor` y errores en `aria-describedby`.

## Cómo verificar cada hito

Comandos base del repo: `npm run test:api` (unit/integración), `npm run test:web` (Vitest), `npm run e2e` (Playwright; trae API+Web propios en 3101/3100 con `apps/api/e2e.db`).

| Hito | Verificación mínima |
|---|---|
| 1.1–1.2 | Test de integración: checkout exitoso marca productos SOLD; segundo checkout del mismo producto falla. E2E en español: comprar una prenda y ver "Vendido" |
| 1.3 | Test API: vendedor lista sus productos; no-vendedor recibe 403 al editar producto ajeno; producto SOLD no es editable |
| 1.4–1.5 | Test DTO: array >6 o URL externa rechazados; test web de galería/zoom y campos nuevos en `/sell` |
| 1.6 | Test API: usuario sin orden DELIVERED del producto recibe error al reseñar; duplicado rechazado |
| 1.7 | Test admin: PATCH con motivo persiste y es visible al vendedor |
| 1.8 | E2E: tras completar checkout se navega a `/orders/[id]` y se muestran número y estado |
| 1.9–1.10 | E2E: footer navega a páginas legales reales (no `/login`); signup exige checkbox |
| 1.11–1.12 | Test integración: exceder el límite de requests devuelve 429; upload con MIME falsificado (magic bytes) es rechazado |
| 1.13 | Test API: filtro `?category=` devuelve solo esa categoría; publicar con categoría fuera de la lista cerrada es rechazado |
| 1.14 | E2E: metadata presente en detalle de producto; sitemap incluye solo productos aprobados |
| 1.15 | Test web: recargar `/sell` a mitad del formulario conserva el borrador; "Publicar otro igual" precarga los campos |
| Hito 2 | Tests de reglas de disputa: una sola por orden, fotos obligatorias, ventana 48h desde DELIVERED, timeout de envío a 7 días cancela y reembolsa, expiración de disputa a 30 días reembolsa al comprador |
| Hito 3 | Webhooks en sandbox del proveedor + idempotencia de PAID; emails en entorno de pruebas SMTP |

## Orden de implementación del Hito 1 (auditoría de implementabilidad)

Con las decisiones cerradas arriba, los 15 ítems son codificables sin nuevas preguntas. Orden respetando dependencias:

1. **1.1+1.2** — migración única: enum `ProductStatus`, `quantity=1`, `updateMany` condicional en la `$transaction`, índices Prisma, `rejectionReason`
2. **1.3** — mis publicaciones + banda de moderación
3. **1.6** — elegibilidad de reseñas + `@@unique`
4. **1.4+1.5** — migración `images [{url, alt}]` + validación DTO + galería/zoom + medidas/defectos
5. **1.13** — selector de categorías primero, luego filtro
6. **1.7** — grilla admin + motivo
7. **1.8** — redirect post-checkout
8. **1.9 → 1.10** — legales + contacto
9. **1.12 → 1.11** — uploads + rate limiting
10. **1.15** — borrador local + publicar otro
11. **1.14** — SEO al final (depende de 1.9 y 1.4)

**Hitos 2–3** (empezar solo con el Hito 1 estable):
1. **2.2** — estados DISPUTED/REFUNDED + reglas y timeouts (`@nestjs/schedule`); 2.1 se redacta sobre este mecanismo
2. **2.3** — transición SHIPPED al vendedor
3. **2.4** — señales visibles ("vendido por", fecha)
4. **3.3** — documentar la monetización decidida antes de tocar dinero
5. **3.1 ⟷ 3.2** — pasarela y emails juntos, al final

## Fuera de alcance (explícito)

- Chat entre usuarios, subastas/regateo, recomendaciones con ML, app móvil, gamificación.

## Registro de críticas (trazabilidad)

> **Cierre del ciclo**: tras 11 rondas los últimos agentes ya no produjeron ideas nuevas viables dentro del alcance, solo cierre de decisiones. Este documento se considera estable: el siguiente avance es implementar según "Orden de implementación del Hito 1" (empezando por 1.1+1.2), no seguir editándolo. Reabrir solo si cambia una premisa verificada del código o llega tracción real.

| # | Agente / ángulo | Resultado principal integrado |
|---|---|---|
| 1 | Factibilidad técnica (sobre código real) | Corrigió premisas: filtros/paginación ya existen; no hay mailer; patrón `updateMany` anti-doble-venta; pagos y emails diferidos juntos |
| 2 | UX / confianza del comprador escéptico | ALTO IMPACTO en fotos/zoom, medidas+defectos, reseña-verificada; propuso devoluciones visibles y "vendido por" |
| 3 | Viabilidad de negocio / alcance | Eliminó métricas admin y precio sugerido del MVP; detectó hueco de devoluciones/envío/monetización; repriorizó favoritos y reputación |
| 4 | Seguridad / fraude | Rate limiting ausente (1.11), validación real de uploads (1.12), reglas anti-abuso de disputas, badge verificado pospuesto |
| 5 | Legal / operación | Páginas legales placeholder (1.9), canal de contacto (1.10), mecánica del dinero y timeouts automáticos en 2.2, política de moderación explícita |
| 6 | Rendimiento / accesibilidad (con `design.md`) | Índices Prisma (schema sin índices), `next/image`+diálogo accesible en galería, alt text por foto, notas frontend (paginación, foco, bug botón anidado) |
| 7 | Auditoría de coherencia interna | Nuevo 1.13 (filtro `category` huérfano), fila de verificación para 1.8, relación política/implementación entre 2.1 y 2.2, plazos concretos en disputas (7d/48h/30d), criterio lanzamiento vs Hito 3 uniformado |
| 8 | Lado oferta / SEO | Banda de estado de moderación en 1.3, selector de categoría bloqueante en 1.13, nuevo 1.14 (SEO técnico mínimo), nuevo 1.15 (fricción de publicación móvil) |
| 9 | Implementabilidad (dev que codifica Hito 1) | 7 decisiones cerradas (checkout completo sin parciales, regla de estados de moderación, `images [{url,alt}]` máx 6, moderación manual, edad 18+, `CONTACT_EMAIL`, lista cerrada de categorías) + orden de implementación de los 15 ítems |
| 10 | Implementabilidad Hitos 2–3 | SHIPPED abierto al vendedor dueño, envío incluido en precio del comprador sin tracking (2.3); MercadoPago sandbox + webhooks por túnel + idempotencia por `paymentId` (3.1); timeouts con `@nestjs/schedule` (2.2); "vendido por {name}" porque User no tiene username (2.4) |
| 11 | Ciclo de vida de datos/cuenta | Mención de eliminación en `/privacidad` (1.9), nuevo ítem de borrado de cuenta con anonimización en "Con tracción", retención de direcciones alineada con la ventana de disputas |

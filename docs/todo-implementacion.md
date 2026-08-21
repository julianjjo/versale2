# TODO — Implementación Versale

> Checklist de control derivado de `docs/funcionalidades-propuestas.md` (v4).
> Orden según "Orden de implementación del Hito 1" + Hitos 2–3.
> Marcar `[x]` solo cuando pase la verificación mínima indicada entre paréntesis.
> Comandos base: `npm run test:api` · `npm run test:web` · `npm run e2e`

---

## Hito 1 — Núcleo transaccional

### 1. Migración base (ítems 1.1 + 1.2 + soporte)

- [ ] Enum `ProductStatus { AVAILABLE, SOLD, WITHDRAWN }` agregado al schema
- [ ] `rejectionReason String?` creado en esta misma migración (no en 1.7)
- [ ] Índices Prisma agregados en la misma migración:
  - [ ] `@@index([isApproved, createdAt(sort: Desc)])` en Product
  - [ ] `@@index([sellerId])` en Product
  - [ ] `@@index([productId])` en OrderItem
- [ ] Checkout marca productos SOLD dentro de la `$transaction` con `updateMany({ where: { id, status: 'AVAILABLE' } })` verificando `count === 1`
- [ ] `quantity = 1` forzado en CartItem/OrderItem
- [ ] Si un ítem no está AVAILABLE → falla el checkout completo con mensaje del producto vendido (sin órdenes parciales)
- [ ] ✅ Verificación: test integración checkout exitoso marca SOLD; segundo checkout del mismo producto falla

### 2. Mis publicaciones (ítem 1.3)

- [ ] Vista/endpoints de listado de productos propios (`where sellerId`)
- [ ] Edición bloqueada para productos SOLD
- [ ] Banda de estado por producto: "En revisión" (`!isApproved && !rejectionReason`) / "Publicado" / "Rechazado: motivo" (`!isApproved && rejectionReason`)
- [ ] Enlace a editar desde el estado "Rechazado"
- [ ] Botón "Publicar otro igual" que precarga título/categoría/talla
- [ ] ✅ Verificación: test API listado propio; 403 al editar producto ajeno; SOLD no editable

### 3. Reseñas verificadas (ítem 1.6)

- [ ] Elegibilidad: solo usuarios con OrderItem en orden DELIVERED para ese producto
- [ ] `@@unique([userId, productId])` agregado a Review (endurecimiento contra carreras)
- [ ] ✅ Verificación: test API sin DELIVERED → error; duplicado rechazado

### 4. Galería + medidas/defectos (ítems 1.4 + 1.5)

- [ ] Migración única: `images Json` pasa a `[{ url, alt }]`, máximo exacto **6**
- [ ] DTO valida: array máx 6, solo URLs del dominio R2 propio (`R2_PUBLIC_BASE_URL`)
- [ ] ⚠️ Decidir: DTO máx 5 o dos tandas de upload (el endpoint `/uploads/images` acepta 5/request)
- [ ] Formulario `/sell`: descripción `alt` obligatoria por foto
- [ ] Campo `measurements String?` con placeholder "pecho/largo/hombro"
- [ ] Campo `defects String?` con placeholder "Sin defectos"
- [ ] Galería con `next/image` (`fill` + `sizes`) sobre contenedor `aspect-[3/4]`
- [ ] Zoom: botón "Ampliar imagen" → diálogo accesible (`role="dialog"`, `aria-modal`, foco atrapado, Esc)
- [ ] ✅ Verificación: test DTO rechaza >6 o URL externa; test web galería/zoom

### 5. Categorías normalizadas + filtro (ítem 1.13)

- [ ] Lista cerrada implementada y compartida frontend/DTO: Camisetas, Camisas, Pantalones, Jeans, Chaquetas, Abrigos, Vestidos, Faldas, Suéteres, Shorts, Calzado, Accesorios, Otros
- [ ] `/sell`: categoría convertida de texto libre a selector (bloqueante del filtro)
- [ ] Backfill: productos existentes fuera de la lista → "Otros"
- [ ] Filtro `category` expuesto en DTO del `findAll` + selector en UI de listado
- [ ] ✅ Verificación: test API `?category=` filtra correctamente; publicar categoría inválida es rechazado

### 6. Moderación (ítem 1.7)

- [ ] Grilla admin con imágenes (`loading="lazy" decoding="async"`)
- [ ] PATCH admin con `rejectionReason` persistente y visible al vendedor
- [ ] Política aplicada: moderación **todo manual** (revisar auto-aprobación tras bloque 3.2)
- [ ] ✅ Verificación: test admin PATCH con motivo visible al vendedor

### 7. Confirmación post-checkout (ítem 1.8)

- [ ] Redirect a `/orders/[id]` tras completar compra (página ya existe)
- [ ] ✅ Verificación: E2E navega a `/orders/[id]` mostrando número y estado

### 8. Legales + contacto (ítems 1.9 + 1.10)

- [ ] Página `/terminos` creada con contenido breve
- [ ] Página `/privacidad` creada (incluye cómo pedir eliminación de cuenta vía mailto)
- [ ] Hrefs del footer corregidos (hoy apuntan a `/login`)
- [ ] Checkbox aceptación de términos + edad mínima (**18 años**) en signup
- [ ] Mailto de contacto con destino `CONTACT_EMAIL` (placeholder visible si falta)
- [ ] ✅ Verificación: E2E footer navega a páginas legales reales; signup exige checkbox

### 9. Uploads seguros + rate limiting (ítems 1.12 + 1.11)

- [ ] Magic bytes verificados con `file-type`; extensión derivada del MIME validado (no del `originalname`)
- [x] `@nestjs/throttler` global + límites estrictos en auth — ya implementado en main
- [ ] Tope de ~20 publicaciones activas por vendedor
- [ ] ✅ Verificación: exceder límite devuelve 429; MIME falsificado rechazado

### 10. Fricción de publicación (ítem 1.15)

- [ ] Borrador automático en `localStorage` en `/sell`
- [ ] ✅ Verificación: recargar a mitad del formulario conserva el borrador

### 11. SEO técnico mínimo (ítem 1.14) — al final del hito

- [ ] `generateMetadata` en `/products/[id]` (title "{título} – {marca} {talla} · Versale", description ~155 chars, OpenGraph con `images[0]`)
- [ ] Metadata estática en listado y home
- [ ] `sitemap.ts` solo con productos `isApproved: true` + páginas legales
- [ ] `robots.ts` excluyendo `/admin`, `/orders`, `/sell`, `/cart`
- [ ] ✅ Verificación: E2E metadata presente; sitemap incluye solo aprobados

---

## Hito 2 — Confianza transaccional

### 12. Disputas y reembolsos (ítems 2.1 + 2.2)

- [ ] `OrderStatus` extendido con `DISPUTED` y `REFUNDED`
- [ ] `@nestjs/schedule` instalado (no hay crons hoy)
- [ ] Timeout: PAID sin SHIPPED a los **7 días** → cancelación automática + reembolso
- [ ] Disputa: una sola por orden, fotos obligatorias del comprador (vía `/uploads/images`)
- [ ] Ventana de disputa: **48h desde DELIVERED**
- [ ] Resolución final siempre por admin; expiración a los **30 días** reembolsa al comprador
- [ ] Política de devoluciones redactada en `/terminos` y resumida en ficha de producto
- [ ] ⚠️ Pendiente de decisión: quién retiene el dinero entre PAID y DELIVERED (antes del Hito 3)
- [ ] ✅ Verificación: tests de disputa única, ventana 48h, timeout 7d, expiración 30d

### 13. Envío definido (ítem 2.3)

- [ ] Transición a SHIPPED abierta al vendedor dueño de los productos de la orden
- [ ] Admin conserva las demás transiciones
- [ ] Envío pagado por el comprador, incluido en el precio (sin tracking esta fase)
- [ ] Flujo documentado en `/terminos` (sección "Envíos")

### 14. Señales de confianza (ítem 2.4)

- [ ] "Vendido por {name}" en card y detalle de producto
- [ ] Fecha de publicación visible ("publicado hace X")
- [ ] Bug corregido: botón interactivo anidado dentro del `<Link>` de la card
- [ ] Recordar: badge "email verificado" NO va aquí (espera bloque 3.2)

---

## Hito 3 — Cobro real

### 15. Monetización declarada (ítem 3.3)

- [ ] Documentada: **0% comisión durante validación, envío a cargo del comprador**

### 16. Pasarela de pagos (ítem 3.1)

- [ ] Proveedor/país decidido por el dueño (cuenta KYC + credenciales)
- [ ] Sandbox de MercadoPago integrado
- [ ] Webhooks vía túnel (ngrok) en dev
- [ ] Idempotencia por `paymentId` externo único en Order
- [ ] Cláusula de responsabilidad en T&C + micro-texto en ficha ("Versale es intermediario")
- [ ] ✅ Verificación: webhooks sandbox + idempotencia de PAID

### 17. Emails transaccionales + flujos de cuenta (ítem 3.2)

- [x] Servicio de email transaccional Brevo (`apps/api/src/notifications/brevo.service.ts`, no-op sin `BREVO_API_KEY`; prueba manual: `node scripts/brevo-test.mjs <email>`)
- [ ] Verificación de email real implementada (columnas del schema ya existen)
- [ ] Recuperación de contraseña funcional
- [ ] Badge "email verificado" activado (desbloquea 2.4)
- [ ] Notificaciones de pago/envío/entrega vía `BrevoService.sendEmail`
- [ ] Tokens con expiración y borrado tras uso
- [ ] ✅ Verificación: emails en entorno SMTP de pruebas

---

## Con tracción (NO hacer antes de tiempo)

> Activar cada uno solo con >500 productos aprobados o usuarios activos pidiéndolo.

- [ ] Favoritos/wishlist (`Favorite` con `@@unique`; SOLD se muestra como "ya vendido")
- [ ] Reputación de vendedor (rating on-demand, sin denormalizar)
- [ ] Página pública de vendedor (`?sellerId=` + `isApproved: true`)
- [ ] Productos relacionados (query simple por categoría)
- [ ] Reporte de producto (con anti-spam: unique usuario/producto)
- [ ] Precio sugerido (solo si N ≥ umbral)
- [ ] Métricas admin (cuando haya usuarios preguntando por números)
- [ ] Borrado de cuenta con anonimización (soft-delete + PII cleanup, productos → WITHDRAWN)

---

## Fuera de alcance permanente

Chat entre usuarios · subastas/regateo · recomendaciones ML · app móvil · gamificación

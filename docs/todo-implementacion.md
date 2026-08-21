# TODO — Implementación Versale (Optimizado para IA)

> **REGLAS GLOBALES DE EJECUCIÓN (WORKFLOW MANDATORIO PARA EL AGENTE):**
> Agente, no trabajes directamente en `main`. Para CADA ítem de esta lista, debes ejecutar estrictamente este pipeline de 8 pasos antes de marcarlo como completado:
> 
> 1. **Selección y Preparación (Sincronización Estricta):** SIEMPRE asegúrate de tener la rama principal limpia y actualizada antes de empezar (`git checkout main && git pull origin main`). Luego, crea y muévete a tu nueva rama de trabajo (ej: `git checkout -b feat/nombre-funcionalidad`).
> 2. **Documentación Detallada del Plan:** Crea la carpeta `docs/<nombre-funcionalidad>/`. Redacta el `.md` con la arquitectura, flujo de datos y estrategia.
> 3. **Revisión del Plan con Agentes (Multi-Angle):** Usa subagentes (ej: `@tintinweb/pi-subagents` o un "Advisor") para evaluar el `.md` en seguridad, arquitectura y rendimiento. Aplica los ajustes.
> 4. **Desarrollo y Pruebas:** Escribe el código. Escribe y verifica pruebas unitarias/integración para garantizar la cobertura.
> 5. **Pull Request (PR) local:** Haz commit de tus cambios. Genera el diff/PR preparatorio.
> 6. **Deep AI Review del Código:** Somete el diff final a una revisión profunda por IA. Corrige cualquier advertencia de seguridad, rendimiento o "code smells".
> 7. **Finalización y Merge Seguro:** Asegura que los tests pasen al 100%. Vuelve a actualizar la rama principal y haz el merge (`git checkout main && git pull origin main && git merge feat/...`).
> 8. **Limpieza y Cierre:** Elimina tu rama local (`git branch -d feat/...`), compacta tu contexto, y finalmente ejecuta `complete_goal`. El **auditor independiente (detached)** verificará el contrato `Done when:` directamente sobre la `main` limpia.

---

## Hito 1 — Núcleo transaccional

- [ ] **1. Migración base:** Enum `ProductStatus { AVAILABLE, SOLD, WITHDRAWN }`, campo `rejectionReason` e índices prisma. Checkout marca `SOLD` en transacción, forzar `quantity = 1` y bloquea compras no `AVAILABLE`. **Done when:** Documentación existe, Deep AI Review superado, rama fusionada a `main`, y `npm run test:api` confirma checkout exitoso y bloqueo de compras dobles.
- [ ] **2. Mis publicaciones:** Vistas/endpoints listado propio. Edición bloqueada para `SOLD`. Banda de estado por producto. Botón "Publicar otro igual". **Done when:** Plan y código revisados por IA, código en `main`, y tests validan edición bloqueada en `SOLD` y error 403 al editar ajeno.
- [ ] **3. Reseñas verificadas:** Límite a usuarios con `OrderItem` `DELIVERED`. Índice único `@@unique([userId, productId])` en `Review`. **Done cuando:** Plan/código revisado por IA, fusionado a `main`, tests API rechazan duplicados y compras no entregadas.
- [ ] **4. Galería, medidas y defectos:** Migrar `images` a `[{ url, alt }]` (máx 6, valida dominio R2). `alt` obligatorio en `/sell`. Campos `measurements` y `defects`. UI con zoom accesible. **Done when:** Deep Review pasado, código en `main`, test DTO rechaza >6 imágenes y UI valida zoom accesible.
- [ ] **5. Categorías normalizadas:** Lista cerrada compartida (front/DTO). Selector en `/sell` y backfill a "Otros". Filtro API `?category=`. **Done when:** Revisión IA superada, merge a `main` realizado, API y DTO filtran y rechazan categorías inválidas en los tests.
- [ ] **6. Moderación manual:** Grilla admin con lazy load. PATCH admin para rechazo con `rejectionReason`. **Done when:** Revisión IA superada, merge a `main`, test API PATCH guarda y expone el motivo.
- [ ] **7. Confirmación post-checkout:** Redirect a `/orders/[id]` tras compra. **Done when:** Merge a `main`, E2E navega a `/orders/[id]` mostrando número/estado.
- [ ] **8. Legales y contacto:** Páginas `/terminos`, `/privacidad`. Links de footer. Checkbox 18+ en signup. Mailto configurado. **Done when:** Merge a `main`, E2E navega a legales y rechaza signup sin checkbox.
- [ ] **9. Uploads seguros y Rate Limiting:** Verificación Magic Bytes (MIME real). Límite de 20 publicaciones activas. **Done when:** Merge a `main`, tests devuelven HTTP 429 por límite y rechazan MIME falso.
- [ ] **10. Fricción de publicación:** Borrador automático en `localStorage` en `/sell`. **Done when:** Merge a `main`, pruebas confirman que recargar la página conserva el borrador.
- [ ] **11. SEO técnico mínimo:** `generateMetadata` dinámico, metadata estática, `sitemap.ts` (solo aprobados) y `robots.ts`. **Done when:** Revisión IA superada, merge a `main`, E2E valida tags y sitemap.

---

## Hito 2 — Confianza transaccional

- [ ] **12. Disputas y reembolsos:** `OrderStatus` con `DISPUTED`/`REFUNDED`. CRON (7 días) para reembolso automático. Disputas (una por orden, 48h). Resolución expirada a los 30 días. **Done when:** Deep AI Review pasado, merge a `main`, y tests cubren timeout 7d, ventana 48h y 30d expiración.
- [ ] **13. Envío definido:** Transición a `SHIPPED` solo para vendedor. Documentación en términos. **Done when:** Merge a `main`, test verifica permisos de transición.
- [ ] **14. Señales de confianza:** Texto "Vendido por {name}" y fecha de publicación. Corrección bug botón anidado. **Done when:** Merge a `main`, componentes renderizan sin errores de hidratación.

---

## Hito 3 — Cobro real

- [ ] **15. Monetización declarada:** Documentar 0% comisión y envíos en términos. **Done when:** Textos en `main` actualizados.
- [ ] **16. Pasarela de pagos (MercadoPago):** Sandbox MP, webhooks (ngrok dev), idempotencia `paymentId`. **Done when:** Diseño en `docs/pasarela/` revisado por IA, merge a `main`, webhooks evitan pagos duplicados (idempotencia) en tests.
- [ ] **17. Emails y flujos de cuenta:** Verificación email real, recuperación password. Tokens caducables. **Done when:** Arquitectura revisada, merge a `main`, tests en entorno SMTP simulan envío y expiración.
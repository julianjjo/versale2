# Mis publicaciones — listado propio, banda de estado y "Publicar otro igual"

> Hito 1, ítem **1.3** (+ porción de 1.15) de `docs/funcionalidades-propuestas.md`.

## Estado previo (verificado en código)

Gran parte del ítem ya existe tras la migración base (1.1+1.2) y trabajos anteriores:

| Capacidad | Estado previo |
| --- | --- |
| Endpoint de listado propio | ✓ `GET /products/mine` (`findAllMine`), con buckets `pending/approved/paused/rejected/sold`, búsqueda y paginación |
| Vista `/mis-productos` | ✓ listado con badges, editar (modal), eliminar, pausa/reactivar individual y bulk, contadores de vistas/favoritos/preguntas |
| Edición bloqueada para `SOLD` | ✓ `update()` rechaza con 400 si `status !== AVAILABLE` (guard de lectura + CAS `status: AVAILABLE` en el `where` del write) — testeado |
| 403 al editar producto ajeno | ✓ ownership check → `ForbiddenException` — testeado |

## Brechas que cierra este hito

### B1 — Banda de estado alineada a la regla cerrada del roadmap

Regla cerrada (roadmap 1.3):

- **Rechazado** = `!isApproved && rejectionReason != null`
- **En revisión** = `!isApproved && rejectionReason == null`
- **Publicado** = `isApproved`

Hoy la página deriva `isRejected` de `rejectedAt` y usa las etiquetas
"Pendiente"/"Aprobado". Se alinea:

- La derivación pasa a usar `rejectionReason` (un rechazo sin motivo escrito
  cuenta como *En revisión* para el vendedor: sin motivo no hay nada accionable,
  y mostrar "Rechazado" sin explicación es peor que silencio).
- Etiquetas nuevas: **Publicado**, **En revisión**, **Rechazado** (+ motivo).
- Los estados de stock/visibilidad (`Vendido`, `Pausado`) conservan su
  precedencia actual: moderación gana sobre pausa; vendido gana sobre todo.
- Las **pestañas de filtro** del listado conservan sus etiquetas actuales
  ("Pendientes"/"Aprobados"/…): son filtros, no la banda de estado por
  producto, y comparten vocabulario con el panel admin.

### B2 — Botón "Publicar otro igual"

Por producto propio (excepto el estado es irrelevante: publicar otro igual a uno
vendido es exactamente el caso de uso), un botón secundario **"Publicar otro
igual"** navega a `/sell` precargando `título`, `categoría` y `talla`.

- Transporte: query params (`/sell?title=…&category=…&size=…`) — cero endpoints
  nuevos, reutiliza el flujo existente de publicación (decisión del roadmap 1.15).
- `/sell` lee los params una sola vez al montar. Como la página es un client
  component prerenderizado, el `useSearchParams` vive en un hijo envuelto en
  `<Suspense>` (requisito de build de Next). La talla se valida contra la
  lista fija `SIZES` (fallback a vacío si no calza) y título/categoría se
  recortan; el usuario edita libremente y los params no vuelven a aplicarse.
- Los valores viajan URL-encoded; el formulario nunca confía en ellos más allá
  de la precarga (las mismas validaciones del DTO aplican al enviar).

## Flujo de datos

```
/mis-productos (fila)
  └─ [Publicar otro igual] → router.push(/sell?title&category&size)
        └─ /sell monta → prefill una vez → usuario completa fotos/precio/descripción
              └─ POST /products (flujo existente, moderación intacta)

Banda por fila:
  status SOLD            → Vendido
  !isApproved && rejectionReason ≠ null → Rechazado (+ motivo visible + enlace Editar)
  !isApproved            → En revisión
  pausedAt ≠ null        → Pausado
  resto                  → Publicado
```

## Alcance de archivos

- **API**: sin cambios (endpoints y guards ya existen y están testeados).
- **Web**: `app/mis-productos/page.tsx` (banda + botón), `app/sell/page.tsx`
  (prefill), specs de ambos.

## Tests

- API (ya existen, se verifican como parte del contrato): edición de `SOLD`
  rechazada (400), edición de producto ajeno rechazada (403).
- Web nuevos: banda según la regla cerrada (incluye rechazado-sin-motivo →
  "En revisión", con fixture `isApproved:false, rejectionReason:null,
  rejectedAt:<set>`), botón navega a `/sell` con título/categoría/talla
  precargadas, y talla fuera de la lista fija no deja valor inválido.
- Web existentes: se actualizan las aserciones de etiquetas de banda
  ("Pendiente" → "En revisión", "Aprobado" → "Publicado") en
  `mis-productos.test.tsx`; las pestañas de filtro no cambian.

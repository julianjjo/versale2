# Notificaciones de preguntas y respuestas (Q&A)

## Problema

El módulo de preguntas existe de punta a punta (comprador pregunta → vendedor responde → panel admin), pero **nadie se entera** salvo que visite la página del producto o el panel por su cuenta:

- El vendedor no recibe aviso de una pregunta nueva: puede pasar días sin responder y la ventana de compra muere.
- El comprador no recibe aviso de que su pregunta fue respondida.

El módulo de notificaciones ya existe con el mismo patrón para órdenes (`OrdersService` llama a `NotificationsService.create/createMany` vía `notifySafely`). Las preguntas son el segundo productor natural y hoy el único omitido.

## Decisiones

| Decisión | Elección | Motivo |
|---|---|---|
| Tipos nuevos | `QUESTION_ASKED`, `QUESTION_ANSWERED` en `NotificationType` | Un enum existente se extiende; SQLite guarda enums como TEXT (sin DDL). |
| Productores | `QuestionsService.create()` → vendedor; `QuestionsService.answer()` → autor de la pregunta | Espejo exacto del flujo real de contenido. |
| Fallo de la notificación | Nunca rompe la operación principal (`notifySafely` privado en QuestionsService) | Misma convención que OrdersService: la notificación es efecto colateral post-commit. |
| Respuestas repetidas | Notifica solo el **primer** answer (`answeredAt === null`) | PATCH `/questions/:id/answer` permite editar la respuesta; re-notificar cada edición sería spam. |
| Deep-link | No se agrega columna nueva | La campana renderiza `message`; el mensaje incluye el título del producto, suficiente para ubicarlo. Ponytail: nada de UI nueva ni migraciones extra. |
| Frontend | Solo extender la unión `NotificationType` en `lib/types.ts` | El bell es genérico; cero componentes nuevos. |

## Flujo de datos

1. Comprador hace `POST /questions { productId, question }`.
   - Validaciones existentes (producto aprobado, no-self-question, tope 5 preguntas/usuario/producto) corren dentro de la `$transaction` actual.
   - Tras el commit de la transacción: notificación al `product.sellerId` con el título del producto (ya disponible en `findRaw`).
2. Vendedor hace `PATCH /questions/:id/answer { answer }`.
   - Ownership check existente del vendedor dueño.
   - Si `answeredAt` era `null`: notificación a `question.askerId`.

## Mensajes (español, convención del repo)

- `Tienes una nueva pregunta sobre «{title}»`
- `Respondieron tu pregunta sobre «{title}»`

## Testing

- **Unit (API)** — `questions.service.spec.ts`:
  - create() crea notificación `QUESTION_ASKED` al vendedor correcto con el mensaje correcto.
  - Fallo del INSERT de notificación NO falla el 201 de la pregunta.
  - answer() crea notificación `QUESTION_ANSWERED` al asker solo en la primera respuesta.
  - Re-edición de la respuesta no duplica notificación.
  - Fallo de la notificación no falla el PATCH.
- **Suite completa**: `npm run test:api` + `npm run test:web` verdes antes de merge.
- E2E: fuera de alcance de este ciclo (la campana ya está cubierta por tests web; los tipos nuevos comparten rendering genérico).

## Riesgos

- Bajo. Dos inserts nuevos condicionados, sin columnas nuevas, sin cambios de contrato de respuesta.

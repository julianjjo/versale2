# Categorías normalizadas (ítem 5)

> Hito 1, ítem 5 de `docs/todo-implementacion.md` / decisión cerrada 1.13 de
> `docs/funcionalidades-propuestas.md`.

## Problema

La categoría era texto libre en `/sell` ("Ej. Chaquetas, Camisetas"). Sin
normalizar, el filtro `?category=` del catálogo era inservible: "chaquetas",
"Jackets" y "Chaquetas de mezclilla" eran categorías distintas a ojos del
filtro, y un typo orillaba el listing fuera de su categoría real.

## Decisión cerrada (lista)

`Camisetas, Camisas, Pantalones, Jeans, Chaquetas, Abrigos, Vestidos, Faldas,
Suéteres, Shorts, Calzado, Accesorios, Otros`

## Diseño

### Contrato compartido

- API: `apps/api/src/products/categories.ts`
- Web: `apps/web/src/lib/categories.ts`

Copias idénticas con comentario cruzado: el monorepo no tiene paquete shared,
y ambas se cubren con tests que fijan la lista exacta — si alguien edita una
sin la otra, un test falla.

### DTO (`create-product.dto.ts`; `update` hereda)

`category` gana `@IsIn(PRODUCT_CATEGORIES)` con mensaje en español que enumera
las opciones. Rechaza variantes, mayúsculas/minúsculas distintas e idiomas
distintos — el filtro solo puede producir queries con sentido.

### Backfill

Migración `product_categories_closed_list`: `UPDATE ... SET category = 'Otros'
WHERE category NOT IN (...)`. Los valores legacy ("Jackets", "Tops", typos)
caen a "Otros" en vez de quedar huérfanos.

### UI

- `/sell`: la categoría pasa de Input libre a `Select` con las 13 opciones.
  El prefill de "Publicar otro igual" normaliza contra la lista: un valor
  fuera de ella cae a "Otros" (nunca deja el select vacío).
- Catálogo (`products-browser`): el filtro de categoría usa la lista cerrada
  en vez de los facets dinámicos — la lista es fija por diseño, no
  data-driven. El filtro de marca sigue siendo facets.

### Filtro API

`?category=` ya existía (match exacto en `findAll`) y conserva su test; ahora
solo puede recibir valores de la lista desde la propia UI.

## Pruebas

- DTO rechaza "Jackets" y "chaquetas" (case-sensitive) y acepta cada valor de
  la lista cerrada.
- API filtra por categoría exacta (test preexistente, se mantiene verde).
- `/sell` precarga categorías válidas del query param; el selector ofrece la
  lista cerrada.
- E2E `author-admin` publica vía `selectOption("Otros")`.

# Fricción de publicación: borrador automático (ítem 10)

> Hito 1, ítem 10 de `docs/todo-implementacion.md`. Escribir una publicación
> buena toma tiempo; perderla por un refresh accidental es la fricción más
> cara del funnel de venta.

## Comportamiento

`/sell` persiste el formulario en `localStorage`
(`versale:sell-draft:v1`) **en cada tecla** — no en intervalos ni en
`beforeunload`, porque el refresh puede llegar en cualquier momento:

- Campos guardados: título, descripción, categoría, marca, talla, condición,
  precio, medidas y defectos.
- Las imágenes NO se restauran: los archivos elegidos no sobreviven un reload
  (solo existen como blobs en memoria) y las URLs ya subidas dependen del
  intento de publicación. Restaurar apuntando a uploads huérfanos sería peor
  que empezar las fotos de nuevo.
- Al publicar con éxito, el borrador se elimina — cumplió su ciclo y no debe
  resucitar en el siguiente `/sell`.
- Escritura best-effort: cuota llena, modo privado o JSON corrupto degradan a
  "sin borrador", nunca rompen la página.

## Precedencia con el prefill

"Publicar otro igual" llega con query params (`?title=&category=&size=`).
Regla cerrada: **el prefill explícito gana** sobre el borrador — es una
intención deliberada del vendedor, y mezclarlo con un borrador viejo produciría
un listing a medio copiar. Sin query params, el borrador restaura todo lo
escrito. La detección usa el query string crudo (no la salida normalizada de
`readPrefill`, cuya categoría siempre es no-vacía por su fallback a "Otros").

## Pruebas

- Unit (`sell.test.tsx`, describe "borrador automático"):
  - 'conserva el borrador al recargar la página' — escribir, desmontar y
    volver a montar conserva título y precio.
  - 'el prefill de Publicar otro igual gana sobre el borrador guardado'.
  - 'limpia el borrador al publicar con éxito' — tras el POST exitoso la key
    desaparece de localStorage.
- Los tests de subida de imágenes limpian localStorage en su `beforeEach`
  (el storage persiste entre tests del mismo archivo).

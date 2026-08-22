# Señales de confianza visibles (ítem 14)

> Hito 1, ítem 14 de `docs/todo-implementacion.md` / decisión cerrada 2.4.
> El badge "email verificado" se pospone a 3.2: sin mailer real promete más
> de lo que garantiza.

## Vendido por {name}

Ya existía en card y detalle (`findAll` incluye `seller {id, name}`); este
ítem lo verifica con tests y le suma la fecha.

## Fecha de publicación

- Card: "Publicado el 12 de agosto de 2026" bajo el vendedor.
- Detalle: fila "Publicado" en la ficha técnica.
- **Formato determinista** (`lib/format-date.ts`): `Intl.DateTimeFormat`
  fijo en `es-CO` + `timeZone: "UTC"` — servidor y cliente producen el mismo
  string. Formatear con la zona local del visitante habría introducido
  exactamente el mismatch de hidratación que este ítem prohíbe.

## Bug estructural corregido: botón anidado en la card

El botón de favorito era descendiente del `<Link>` de la card — HTML
inválido (un interactivo dentro de otro), mal anunciado por lectores de
pantalla y fuente clásica de errores de hidratación. Ahora:

- La card es un `div.relative`; el `<Link>` cubre imagen + contenido, y
  `FavoriteButton` es **hermano posicionado** (`absolute right-3 top-3
  z-20`) sobre la imagen.
- El anillo de foco de la card se mantiene vía `focus-within`/`:has`.

## Pruebas

- 'renderiza el botón de favorito fuera del enlace de la card' — ningún
  `<Link>` de card contiene un `<button>`, y el favorito no desciende de
  ningún enlace.
- 'renderiza las cards sin errores ni warnings de React en consola' —
  espía sobre `console.error` durante el render completo de las cards.
- Fecha visible en card ('publicado el') y fila "Publicado" en el detalle;
  "Vendido por" ya asertado.

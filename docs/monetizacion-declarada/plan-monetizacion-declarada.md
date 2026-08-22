# Monetización declarada (ítem 15)

> Hito 1, ítem 15 de `docs/todo-implementacion.md` / decisión cerrada 3.3 de
> `docs/funcionalidades-propuestas.md`: documentar la monetización **antes**
> de tocar dinero.

## Decisión cerrada

**0% comisión durante la fase de validación**, para vendedor y comprador —
el precio que se ve es el precio de la prenda. El envío va a cargo del
comprador pero está incluido en el precio publicado (decisión 2.3, ya
documentada en `/terminos` desde el ítem 13).

Cualquier comisión futura se anunciará en `/terminos` y en la plataforma con
antelación antes de aplicarse; se revisa al activar cobros reales (3.1,
MercadoPago).

## Texto en `main`

`/terminos` suma la sección «Comisiones» con la declaración anterior.
La sección «Envío de los productos» (ítem 13) ya documentaba el envío.

## Pruebas

Ítem solo-documental: no agrega comportamiento. La suite existente (API +
web) debe seguir verde y el build renderiza la página estática sin errores —
eso es el pipeline de este ítem.

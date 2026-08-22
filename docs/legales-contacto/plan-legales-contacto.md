# Legales y contacto (ítem 8)

> Hito 1, ítems 1.9 + 1.10 de `docs/funcionalidades-propuestas.md`.
> Imprescindible pre-lanzamiento: prometer en texto algo que no existe es peor
> que no prometerlo.

## Estado

- **Páginas reales**: `/terminos`, `/privacidad`, `/contacto` y `/ayuda`
  existen con contenido propio; los links del footer apuntan a ellas (ya no
  al placeholder de `/login`).
- **Signup**: checkbox obligatorio de consentimiento — mayor de 18 años +
  aceptación de Términos y Política de privacidad (links inline). Sin marcar,
  el registro ni llama al backend ni navega.
- **Canal de contacto**: variable `NEXT_PUBLIC_CONTACT_EMAIL` (espejo web de
  `CONTACT_EMAIL`; Next solo inliga vars con ese prefijo) expuesta vía
  `apps/web/src/lib/contact.ts`. Con ella configurada, `/contacto` muestra
  mailto real y `/privacidad` declara el mecanismo de eliminación de cuenta
  por correo (asunto «Eliminar mi cuenta»). Sin configurar, ambas páginas
  muestran un placeholder visible — nunca un link muerto.

## Pruebas

- Unit (`signup.test.tsx`): el checkbox está presente con sus links; sin
  marcarlo el submit muestra el error, no llama a `signup` ni navega.
- E2E (`legal-signup.spec.ts`):
  - El footer navega a `/terminos` y `/privacidad` (headings visibles).
  - Signup sin checkbox → mensaje de consentimiento, sigue en `/signup`.
  - Signup con checkbox → crea la cuenta y aterriza en `/products`.

## Configuración

`NEXT_PUBLIC_CONTACT_EMAIL=""` agregado a `apps/web/.env.example`.

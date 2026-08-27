# Web set-state-in-effect — disable with justification (2 errors)

## Problema

`npx eslint .` (web) → 2 errors `set-state-in-effect`:

- `apps/web/src/app/sell/page.tsx:42` — `useEffect` con `setAnnouncement("")` vía `setTimeout` para auto-clear de anuncio (a11y live region). No es derived state, es temporizador externo.
- `apps/web/src/components/layout/header.tsx:377` — `useEffect` con `setIsOpen(false)` al cambiar `pathname` (cierra menú móvil al navegar). Sync intencional de estado UI con navegación.

Ambos son sync intencional, no cascading derived state.

## Solución

Añadir `// eslint-disable-next-line react-hooks/set-state-in-effect -- ...` con justificación antes de cada `useEffect`:

- `sell/page.tsx:42` — `announcement` auto-clear 3s, es efecto con timer externo, no derived render.
- `header.tsx:377` — cierra menú al navegar, sync UI con `pathname`.

## Verificación

- `npx eslint .` (web) → 0/0
- `npm run test:web` 45/45 557/557

# refactor(web): remove explanatory comments from cart page (ponytail ultra, -40L)

## Qué
- `apps/web/src/app/cart/page.tsx`: elimina ~40 líneas de bloques de comentarios explicativos (`//` y ` {/* ... */}`), sin tocar lógica.

## Por qué (ponytail ultra)
- Los comentarios duplican lo que el código ya expresa (`RECENT_ORDER_WINDOW_MS`, `isUnavailable`, `isPaused`, etc.) y ruido histórico de decisiones ya estabilizadas. El código queda legible sin ellos; YAGNI.

## Alcance
- 1 archivo, -40L aprox.
- Sin cambios de `import`/`export`, sin cambios de UI (español preservado).

## Verificación
- `npm run test:web` 43/545
- `npm run test:api` 47/714
- `git diff --stat` 1 file

## Riesgo
- Bajo. Solo documentación inline; lógica y tests intactos.

Refs: `docs/cart-comment-cleanup/design.md`

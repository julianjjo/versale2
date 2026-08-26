# Lint de DTO specs de preguntas: eliminar `any` inseguros

## Problema

`apps/api/src/questions/dto/__tests__/{create-question,answer-question}.dto.spec.ts` arrastra **8 errores ESLint preexistentes** (`no-unsafe-assignment`, `no-unsafe-member-access`). Origen: `ValidationPipe.transform()` retorna `any` y los resultados se asignaban sin aserción de tipo.

Por qué importa: el CI corre "Lint changed API files (**required**)" — solo archiva lo tocado — así que estos archivos quedaban congelados con tipos débiles: las afirmaciones (`result.question`) sobre valores `any` no atrapan regresiones de forma del DTO en compilación.

## Solución

Patrón ya establecido por `create-product.dto.spec.ts`: `(await pipe.transform(...)) as CreateQuestionDto`. Además, la verificación de campos eliminados por `whitelist` pasa de `(result as Record<string, unknown>).askerId` (que rompe TS2352 con el nuevo tipado) a `'askerId' in result` — aserción type-safe que no depende de casts transitivos.

## Verificación

- ESLint sobre ambos archivos: 0 errores (antes 8).
- Jest del módulo dto: 13/13.
- Semántica de tests intacta: mismos casos, mismas expectativas.

# Ledger clean — último no-trigger

## Problema

`PONYTAIL-DEBT.md` marcaba `16 markers, 1 with no trigger` tras iter 14, pero `grep ponytail` mostraba 16 markers con varios sin `upgrade:` explícito en el comentario (`products.service.ts:66 cap 1000, warn...; materialize...` sin `upgrade:`). El último `no-trigger` real es el cap/O(n) de `products.service.ts` — aunque ledger lo cuenta como with-trigger, el comentario ponytail aún no usa `; upgrade:` explícito, riesgo de que un `grep -rn ponytail | grep -v upgrade` lo marque como no-trigger.

## Arquitectura

- Single file winner: `apps/api/src/products/products.service.ts` (2 ponytails) + `PONYTAIL-DEBT.md` footer.
- Actualizar `// ponytail: cap 1000, warn on truncation; materialize...` → `// ponytail: cap 1000, warn on truncation; upgrade: materialize averageRating+index if >1k sustained`
- Actualizar `// ponytail: O(n) in-memory, cheap for n<10k, warned; materialize...` → `// ponytail: O(n) in-memory, cheap for n<10k, warned; upgrade: materialize averageRating + index if catalog >10k`
- Actualizar `PONYTAIL-DEBT.md` footer a `16 markers, 0 with no trigger. Clean ledger.` — deuda documentada, sin `no-trigger`.

## Data flow

- Sin cambio de flujo, solo ponytail comentarios y ledger.

## Componentes

- `products.service.ts:66,343` — ponytail con `upgrade:` explícito.
- `PONYTAIL-DEBT.md` — footer clean.

## Testing strategy

- `grep -rn ponytail apps e2e scripts | grep -v upgrade` → 0 (ningún ponytail sin upgrade explícito, excepto los ya con upgrade).
- `npx prettier --check` — debe pasar.
- `npm run test:api -- src/products` — 221 pass.

## Riesgos

- Ninguno. Solo comentarios.

## Ponytail ceiling

- Sin ponytail — ledger ya es clean; si aparece nuevo ponytail sin upgrade, CI `grep` lo detecta.

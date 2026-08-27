# Ops sync main — 0237483 → origin/main (140+ commits)

## Problema

`main` está 140+ commits ahead de `origin/main` (desde `febaed2` #162 hasta `0237483` qa-64, pasando por 13 lint slices, 5 perf singletons, 3 sweep paginations, 2 web abort, etc.). Sin push, `origin/main` no refleja `lint 0/0` ni `729/559` gates, y cualquier `git pull` en CI/e2e trae base vieja. Además `git worktree list` acumula 4 `.pi` + 3 `.worktrees` stale (detached HEAD `d263097`, `5af970e`, `553ba7c`).

## Solución

- `git push origin main` (fast-forward, 0 conflicts, 140 commits).
- Post-push `git worktree remove` para `.pi` worktrees si ya mergeados, y `git fetch origin` para sync.

## Verificación

- `git log origin/main..main` → 0
- `git log --oneline -3` en `origin/main` muestra `0237483`
- `git worktree list` sin `d263097` etc. tras prune

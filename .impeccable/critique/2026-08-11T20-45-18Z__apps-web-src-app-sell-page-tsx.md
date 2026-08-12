---
target: Sell (/sell)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-08-11T20-45-18Z
slug: apps-web-src-app-sell-page-tsx
---
Method: dual-agent (A: ada5d5ed3d7b7d6b0 · B: a36be88a8ef3613e7)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Publishing gives zero confirmation — silent redirect to /products, where the new (unapproved) listing isn't even visible |
| 2 | Match System / Real World | 3 | Natural Spanish and placeholder examples; one English string leaks through on upload failure |
| 3 | User Control and Freedom | 3 | Individual image removal, free field editing, Cancelar button |
| 4 | Consistency and Standards | 2 | CTA breaks the app's own accent convention; Categoría is free text while equally-enumerable Talla/Condición are selects |
| 5 | Error Prevention | 1 | No required-field markers; no live validation, only native browser constraint validation at submit |
| 6 | Recognition Rather Than Recall | 3 | Strong, concrete placeholder examples; Categoría still asks the user to invent a taxonomy |
| 7 | Flexibility and Efficiency | 2 | Efficient single-screen form (real strength for "posting, not applying"); no draft autosave, no drag-and-drop |
| 8 | Aesthetic and Minimalist Design | 2 | Page/Card/Input all resolve to the identical background color — only a hairline separates them |
| 9 | Error Recovery | 1 | Failed image upload surfaces the raw backend string "Failed to upload image to storage" verbatim, in English |
| 10 | Help and Documentation | 2 | Good moderation-expectation microcopy; footer's seller-guidance links ("Cómo funciona," "Calculadora de ganancias") all point back to /sell itself |
| **Total** | | **21/40** | **Acceptable (52.5%)** |

## Design Specificity Verdict

Largely generic. Structurally low-friction (matches the "post, don't apply" principle) but visually interchangeable with any CRUD "create record" form — the CTA that turns a browser into a seller is plain ink, not terracotta, and the flat ungrouped field stack has no chunking.

**Deterministic scan**: CLI on sell/page.tsx = 0 findings. Browser scan = 19-22 findings; none originate in sell/page.tsx — all trace to shared Topbar/Footer chrome or global theme tokens. Geometry-based findings (17 of them) were captured under a confirmed 0×0-viewport session bug and should be treated as unreliable; non-geometry findings stand.

## Priority Issues

- **[P0] Publishing gives zero confirmation, and the redirect target can't show the result.** Verified live: a real submitted listing (isApproved:false) doesn't appear anywhere the user lands, and no "mis publicaciones" view exists anywhere in the app. Fix: show an inline success state before redirecting, or build a minimal seller-listings view.
- **[P1] No field-level validation feedback; an English string leaks through on failure.** The existing styled `error` prop is never wired up; a failed image upload shows raw English text on an all-Spanish product. Fix: localize the backend message; wire client validation into the existing error slot.
- **[P2] The CTA that turns a user into a seller carries no brand accent.** Fix: use the `accent` Button variant for "Publicar producto."
- **[P2] No visual cue for which fields are required** — only optional fields are marked.
- **[P3] Free-text Categoría field with no fixed taxonomy**, while structurally identical Talla/Condición are selects — invites catalog drift as volume grows.

## Persona Red Flags

- **Sam** (first listing): submits carefully, lands on /products, can't find the item anywhere — no way to distinguish "it worked, pending review" from "it silently failed."
- **Riley** (limited English): a failed photo upload shows "Failed to upload image to storage" — untranslated on an otherwise all-Spanish product.
- **Casey** (repeat seller): has learned there's no confirmation, so manually checks other pages every time to verify a listing "took."

## Minor Observations

No character limit/counter on Título/Descripción; price input has no live COP thousands-separator preview despite a `Price` component that already formats this elsewhere; file input is the bare native picker, no drag-and-drop; Cancelar calls bare `router.back()` with no "discard changes?" confirmation.

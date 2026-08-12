---
target: Signup (/signup)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-11T20-45-06Z
slug: apps-web-src-app-signup-page-tsx
---
Method: dual-agent (A: a1c362354c189f4f1 · B: a2797449ca6e0f749)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Button swaps to "Creando cuenta…" but success is a silent redirect with zero acknowledgment |
| 2 | Match System / Real World | 3 | Natural labels; specific duplicate-email error ("Ya existe una cuenta con ese correo") |
| 3 | User Control and Freedom | 4 | Clear login link, no modal trap, normal back-nav |
| 4 | Consistency and Standards | 2 | CTA uses zero terracotta anywhere on the page (verified: no `rgb(200,98,58)` under `<main>`) |
| 5 | Error Prevention | 2 | Native-browser-only validation, one field at a time |
| 6 | Recognition Rather Than Recall | 4 | Labels stay visible; password hint shown before typing |
| 7 | Flexibility and Efficiency | 3 | autoComplete correctly set for name/email/new-password |
| 8 | Aesthetic and Minimalist Design | 2 | Card background is identical to page background; 64px heading in a 16px-padded box reads unbalanced |
| 9 | Error Recovery | 2 | Server error is specific and accessible, but no field is marked invalid |
| 10 | Help and Documentation | 2 | Only help affordance (footer) points to /login, not a resource |
| **Total** | | **27/40** | **Acceptable (67.5%)** |

## Design Specificity Verdict

Largely generic. Only the Fraunces headline and Spanish copy are brand-specific; ink-colored button, background-matched card, and zero terracotta make it interchangeable with any B2C SaaS signup. DESIGN.md calls terracotta the accent that "carries every brand beat" — absent entirely from the account-creation moment.

**Deterministic scan**: CLI on signup/page.tsx = 0 findings. Browser scan = 20-21 findings; all but one ("Iniciar sesión" link overflowing by 27px, genuinely in signup/page.tsx) trace to the site-wide Topbar/Footer.

## Priority Issues

- **[P1] Brand accent is entirely absent from the primary CTA.** DESIGN.md names terracotta the sole brand signal; its total absence at the conversion moment makes the page feel unbranded. Fix: use the `accent` Button variant.
- **[P1] Client-side validation bypasses the app's own error-display system.** Only native browser tooltips fire; `Input`'s `error` prop is never used. Fix: wire server 400s / basic client checks into `Input`'s `error` prop.
- **[P2] Card provides no visual separation from the page** — background color is identical to the page body. Fix: increase padding, add real contrast/shadow.
- **[P2] Successful signup has no acknowledgment** — silent redirect to `/products`. Fix: brief welcome toast before/during redirect.
- **[P3] Authenticated users aren't redirected away from /signup** — a logged-in user can still load and interact with the create-account form.

## Persona Red Flags

- **Jordan**: checks Términos/Privacidad before signing up (trust check) and lands on /login instead — exactly the moment their trust decision is being made.
- **Sam**: has a stale /signup bookmark while already logged in; no signal that an account already exists.
- **Riley**: submits empty, gets only one field's native tooltip at a time instead of all invalid fields flagged together.

## Minor Observations

Header shows both "Iniciar sesión" and "Crear cuenta" while already on /signup; no password show/hide toggle or strength indicator; loading state is text-only despite a shared Spinner component existing; no terms/consent checkbox (likely intentional per PRODUCT.md's open decisions).

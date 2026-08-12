---
target: Login (/login)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T20-45-06Z
slug: apps-web-src-app-login-page-tsx
---
Method: dual-agent (A: a9a5ebbfeb00f7caf · B: a9c600a4adb00f6ba)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No spinner despite DESIGN.md's stated pattern; focus isn't moved to the error on failure |
| 2 | Match System / Real World | 4 | Natural, plain-language Spanish throughout |
| 3 | User Control and Freedom | 1 | No forgot-password flow anywhere in the app |
| 4 | Consistency and Standards | 3 | Consistent with /signup, but omits password recovery (near-universal convention) |
| 5 | Error Prevention | 3 | Native required/type=email validation works; values preserved after failed submit |
| 6 | Recognition Rather Than Recall | 4 | Persistent labels above fields |
| 7 | Flexibility and Efficiency | 3 | autoComplete correctly wired for password managers; no show-password toggle |
| 8 | Aesthetic and Minimalist Design | 4 | Clean, focused single-card layout |
| 9 | Error Recovery | 1 | "Credenciales inválidas" offers no next step; network failures leak untranslated English "Network Error" |
| 10 | Help and Documentation | 0 | The only "help" link (Centro de ayuda) and 5 other footer links all resolve back to /login |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Design Specificity Verdict

Branded at the surface (Fraunces heading, purpose-anchored Spanish subhead) but generic underneath — strip the type/color and the interaction model is indistinguishable from any SaaS login form; nothing expresses "curated secondhand marketplace" or reduces the specific anxiety of being locked out of buying/selling.

**Deterministic scan**: CLI on login/page.tsx = 0 findings. Browser runtime scan = 20 findings, but 19 trace to the site-wide Topbar/Footer, not the login page's own markup. The one page-specific hit ("Crear cuenta" link overflow) plus all 18 text-overflow findings were measured while this session's browser tab reported a 0×0/non-compositing viewport — flagged as an environment limitation, not a confirmed defect; recommend re-verifying geometry findings with a working render.

## Priority Issues

- **[P0] No password-recovery path; the app's one "help" link loops back to /login.** Precisely the highest-anxiety moment ("can't get in") and the product has no answer beyond "try again." Fix: add forgot-password flow; point footer links at real destinations.
- **[P1] Network/server failures show untranslated English ("Network Error").** Breaks the all-Spanish copy commitment at the failure mode most likely to spike anxiety. Fix: detect `!err.response` in `extractApiError` and return Spanish fallback copy.
- **[P1] Login bypasses the design system's own accessible error pattern.** `Input` already supports `error` → `aria-invalid`/`aria-describedby`, but the page renders a separate unlinked alert instead. Fix: pass the error into the `Input`s.
- **[P2] Redundant "Iniciar sesión" chrome while already on the login page.** Header and footer both repeat the login CTA. Fix: hide/replace on `pathname === "/login"`.
- **[P3] No password-visibility toggle; loading state skips the documented Spinner pattern.**

## Persona Red Flags

- **Sam**: clicks footer "Envíos"/"Términos" expecting legal/shipping info, lands back on /login instead.
- **Riley**: a dropped connection surfaces the untranslated "Network Error" string on an all-Spanish app.
- **Casey**: notices Centro de ayuda, Privacidad, Términos, Contacto are all dead loops to /login right before a trust-sensitive purchase decision.

## Minor Observations

Tab title never changes per route; "Crear cuenta" link has no visible affordance until hover (no touch cue); `minLength={6}` present on the login form too (harmless today); DESIGN.md documents `--color-danger: #DC2626` but globals.css ships `#b91c1c` (a design-doc/implementation drift, the shipped value is actually the more accessible one).

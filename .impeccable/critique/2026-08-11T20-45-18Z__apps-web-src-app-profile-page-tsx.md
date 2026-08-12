---
target: Profile (/profile)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T20-45-18Z
slug: apps-web-src-app-profile-page-tsx
---
Method: dual-agent (A: a74ac01b5c260001f · B: ae399c8495fb16e72)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Nada que actualizar" reuses the same green success styling as a real save |
| 2 | Match System / Real World | 3 | Helpful, natural password placeholder copy; otherwise no marketplace-specific context |
| 3 | User Control and Freedom | 2 | No cancel/reset once fields are edited; no confirmation step before a credential change |
| 4 | Consistency and Standards | 3 | Reuses shared Input/Button/Card, but breaks the brand's own accent convention (no terracotta) |
| 5 | Error Prevention | 1 | No current-password field to confirm identity before changing email/password; no confirm-password field |
| 6 | Recognition Rather Than Recall | 4 | Name/email pre-filled with real current values; password field intentionally left blank |
| 7 | Flexibility and Efficiency | 2 | No `autoComplete` set on any of the 3 inputs, unlike /login's inputs |
| 8 | Aesthetic and Minimalist Design | 3 | Clean layout; oversized 64px Fraunces H1 for a one-line caption is disproportionate ceremony |
| 9 | Error Recovery | 2 | `Input`'s `error` prop (red border + aria-invalid) exists but is never wired up here |
| 10 | Help and Documentation | 3 | Proportionate for a 3-field form |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Design Specificity Verdict

Functionally wired to Versale but visually generic — zero terracotta anywhere on the page (identity badge is neutral gray, primary button is plain ink). Swap the copy to English and this could be any Next.js SaaS `/settings` route.

**Deterministic scan**: CLI on profile/page.tsx = 0 findings. Browser scan = 6 findings (captured twice, byte-identical for confidence), all tracing to shared Topbar/Footer/global CSS — none originate in profile/page.tsx itself. The Footer's ink-on-ink `FooterColumn` heading bug (confirmed elsewhere this session) reproduces here too.

## Priority Issues

- **[P0] No re-authentication before changing password or email.** One "Guardar cambios" button handles name, email, and password together with no current-password gate and no confirm-password field. On a platform whose #1 product principle is "Trust before volume," this is the weakest possible error prevention on the account's own credential-change surface. Fix: require current password to authorize sensitive-field changes.
- **[P1] Field-level errors aren't wired up.** A generic bottom-of-form message doesn't say which field failed (duplicate email? weak password?). Fix: parse the API error for a field key, pass into the corresponding `Input`'s `error` prop.
- **[P1] Zero brand presence on the account page.** "Guardar cambios" uses the ink `primary` variant, not `accent`. Fix: apply the accent variant or add a terracotta touch to the identity card.
- **[P2] Required/optional ambiguity and missing autocomplete** — nothing marks the password field optional; none of the 3 inputs set `autoComplete`.
- **[P3] "Nothing to update" borrows the success visual language**, which can mislead a user into thinking an edit was saved when it wasn't.

## Persona Red Flags

- **Sam**: on a shared/borrowed device, notices the password field sits right there with no current-password gate — anyone using the computer afterward could silently overwrite the login credentials in one submit.
- **Riley**: edits the email field with no confirm-new-email step; a typo means losing order/payment notifications with no built-in recovery.
- **Casey**: with a long name/email, the "Conectado como" row has no truncation guard against the fixed-width role badge.

## Minor Observations

"Cerrar sesión" is duplicated (header nav + profile card); the badge never reflects that a USER has become a functional "seller" by listing a product, per PRODUCT.md's own model; footer help links dead-end at /login on the one page where credentials can change.

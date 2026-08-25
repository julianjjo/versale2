# Versale — Design System

> Polished, editorial visual identity for the Versale used-clothing marketplace.
> Authored from `index.html` (the static landing reference) and adapted to the
> existing Next.js + Tailwind v4 frontend under `apps/web`.

## Context and goals

Versale is a used-clothing marketplace targeting Spanish-speaking buyers and
sellers. The product must feel like an editorial fashion magazine — warm,
trustworthy, and unhurried — while staying performant and accessible.

- **Brand voice**: concise, confident, helpful; written in Spanish.
- **Visual register**: editorial, warm, slightly luxurious. Soft neutrals, a
  single terracotta accent, oversized serif display, and a quiet sans body.
- **Job to be done**: help users discover and trust second-hand fashion via a
  catalog that feels curated, plus a seller flow that removes friction.
- **Out of scope**: marketing/SEO landing pages are out of scope for this
  document; they live in `index.html` and are imported as static references.

## Design tokens and foundations

All visual decisions resolve to one of the tokens below. Tailwind v4 utility
classes map 1:1 to these tokens via `@theme inline` in `globals.css`.

### Color palette

The palette is a warm, paper-and-ink set. Ink is the primary surface, a single
terracotta accent carries every brand beat, and three neutral surfaces keep
content breathable.

| Token              | Value      | Role                                                        |
| ------------------ | ---------- | ----------------------------------------------------------- |
| `--color-ink`      | `#1a1a1a`  | Primary text and dark surfaces (topbar, story, footer).     |
| `--color-ink-2`    | `#3a3a3a`  | Hover state of dark surfaces.                               |
| `--color-paper`    | `#f6f3ee`  | Page background and text on dark surfaces.                  |
| `--color-paper-2`  | `#efe9dc`  | Soft card surface (steps, testimonials, editorial card).    |
| `--color-paper-3`  | `#e8e0d2`  | Image placeholder, product image background.                |
| `--color-muted`    | `#7a6a55`  | Secondary text (eyebrows, captions).                        |
| `--color-muted-2`  | `#5a5045`  | Body text on paper.                                         |
| `--color-muted-3`  | `#8f887c`  | Disabled text, strikethrough (darkened from `#a09a90` for 4.5:1 on paper). |
| `--color-line`     | `rgba(26,26,26,.1)`  | Hairline borders on paper.                          |
| `--color-line-2`   | `rgba(26,26,26,.15)` | Stronger hairline borders.                         |
| `--color-line-3`   | `rgba(246,243,238,.1)` | Hairline borders on ink.                         |
| `--color-line-4`   | `rgba(246,243,238,.15)` | Stronger hairline borders on ink.                |
| `--color-terracotta` | `#c8623a` | Brand accent — italic emphasis, badges, icons, large text. |
| `--color-terracotta-deep` | `#a04d2c` | Darker accent step. Required for solid-fill CTA backgrounds and for terracotta text below 14px — plain `--color-terracotta` doesn't clear 4.5:1 as a background against paper or ink text at those sizes. |
| `--color-terracotta-light` | `#d67348` | Lighter accent step, for terracotta text/eyebrows on `--color-ink` surfaces (plain terracotta fails 4.5:1 there too). |
| `--color-success`  | `#166534`  | "Live" pulse, positive status (darkened from `#4a8a4a` for 4.5:1). |
| `--color-danger`   | `#b91c1c`  | Destructive actions, form errors (darkened from `#DC2626` for 4.5:1). |
| `--color-warning`  | `#9a3412`  | "Pending" status (darkened from `#D97706` for 4.5:1).       |
| `--color-info`     | `#1d4ed8`  | Neutral informational states (darkened from `#2563EB`: badges paint each status token on its own 10% tint, where the old value read 4.10:1 against its peers' 4.98–5.66:1). |
| `--color-control`  | `#82796c`  | Form-control boundary — inputs, selects, textareas, checkboxes, file-picker buttons. Not for structural hairlines. |

Aliases (kept stable from the previous system so existing Tailwind classes
keep working):

| Alias                  | Maps to                |
| ---------------------- | ---------------------- |
| `--color-text-primary` | `--color-ink`          |
| `--color-text-muted`   | `--color-muted-2`      |
| `--color-text-inverse` | `--color-paper`        |
| `--color-surface`      | `--color-paper`        |
| `--color-surface-muted`| `--color-paper-2`      |
| `--color-border`       | `--color-line`         |
| `--color-border-strong`| `--color-line-2`       |
| `--color-primary`      | `--color-terracotta`   |
| `--color-primary-foreground` | `--color-ink`  |

### Color scheme

This is a single, committed light world: no token above has a dark
counterpart and there is no dark theme to switch to. `:root` therefore
declares `color-scheme: light`, which stops a device set to dark from
force-darkening the canvas, the scrollbars, autofill, and the native chrome
of `<select>` and date popups into colours that resolve to no token here.
Adding a dark theme is a new decision, not a default — it would mean a second
value for every token, not flipping this line.

### Typography

Two families carry the brand:

- **Display** (Fraunces, serif) — headlines, prices, and the italic word
  emphasis (`<em>`). Variable font, opsz axis. Weights 300–700. Used at
  oversized sizes with tight letter-spacing (`-0.02em` to `-0.04em`).
- **Body** (Inter, sans) — paragraphs, labels, buttons, navigation. Weights
  300–700. Standard letter-spacing.

| Token              | Family  | Size (mobile → desktop)        | Use                       |
| ------------------ | ------- | ------------------------------ | ------------------------- |
| `text-display-xl`  | Fraunces| `clamp(56px, 9vw, 148px)`      | Hero `h1`.                |
| `text-display-lg`  | Fraunces| `clamp(40px, 5.5vw, 80px)`     | Section `h2` (story).     |
| `text-display-md`  | Fraunces| `clamp(38px, 5vw, 72px)`       | Section `h2` (default).   |
| `text-display-sm`  | Fraunces| `clamp(36px, 4.5vw, 60px)`     | Products section heading. |
| `text-editorial`   | Fraunces| `54px`                         | Editorial card `h2`.      |
| `text-stat`        | Fraunces| `64px` line-height 1           | Story stats.              |
| `text-price`       | Fraunces| `18px` (mobile 16px)           | Product price.            |
| `text-hero-meta`   | Fraunces| `30px`                         | Hero counter numbers.     |
| `text-step-num`    | Fraunces| `80px` italic, 12% opacity     | How-it-works step number. |
| `text-testimonial` | Fraunces| `22px` line-height 1.35        | Testimonial quote.        |
| `text-marquee`     | Fraunces| `24px` italic                  | Marquee.                  |
| `text-eyebrow`     | Inter   | `11px`, letter-spacing `.18em`, uppercase | Section eyebrow.   |
| `text-cta-foot`    | Inter   | `12px`                         | CTA footnote.             |
| `text-body`        | Inter   | `14–16px`                      | Body copy.                |
| `text-caption`     | Inter   | `11–13px`                      | Captions, labels.         |
| `text-nav`         | Inter   | `14px` weight 500              | Navigation links.         |
| `text-btn`         | Inter   | `13–14px` weight 500           | Buttons.                  |

Rules:

- Display italic (`<em>`) is the editorial emphasis. Use it on a single word
  in headlines and on the CTA heading. Color is `--color-terracotta`.
- Strikethrough in display headings is a hero-only effect. Implement with a
  span of class `strike` using a 6px terracotta underline rotated -3deg.
- Body never uses Fraunces. Display never uses Inter except inside eyebrows.
- Money uses a tabular numeric variant, set in Fraunces like every other
  display token. The `Price` component sets `font-display tabular-nums`;
  preserve it. Do not add `font-mono` to it — a monospace font-family
  utility cascades ahead of any display override in the generated
  stylesheet regardless of class order in JSX, which is exactly how this
  broke previously.

### Spacing scale

- Base: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80 / 120.
- `gap-3` is the default for related controls; `gap-6` for grouped blocks.
- Section vertical padding: `120px` desktop, `80px` mobile.
- Container max width: `1320px` for marketing, `max-w-5xl` / `max-w-6xl` for
  in-app pages.
- `--header-h` (`4rem`) is the height of the sticky `<Header>`. It is the
  single source of truth for anything that has to line up with the header:
  the header bar itself, the mobile menu panel that hangs off its bottom
  edge, and the `.scroll-anchor` deep-link offset. Do not re-type `h-16` /
  `top-16` next to it — read the token, so the three cannot drift apart.

### Radius

- Pills (CTAs, nav, filters): `9999px`.
- Cards and inputs: `14px` (compact) or `18px` (large), or `20–24px` for
  editorial cards.
- Product image: `14px`; category tile: `18px`.

### Elevation

- Soft floating cards: `box-shadow: 0 20px 50px -20px rgba(26,26,26,.25);`
- Pills / badges: `box-shadow: 0 6px 20px -8px rgba(26,26,26,.2);`
- Default card (in-app): `shadow-sm` from Tailwind.

### Motion

- Default easing: `cubic-bezier(0.25, 1, 0.5, 1)`; token name: `--ease-out`.
- Durations: `200ms` (micro), `300ms` (controls), `600–800ms` (image zoom).
- Hover translate: `-2px` for buttons, `-4px` for product cards.
- Marquee: 30s linear infinite.
- Pulse on the "Live" badge: 2s ease-out infinite `ping`.

## Component-level rules

Every component below must define required states and document spacing, type,
and color token usage.

### Topbar (`<div class="topbar">`)

- Background `--color-ink`, text `--color-paper`.
- Centered single line, `12px`, letter-spacing `.12em`, uppercase. The single
  line is enforced in CSS (`white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis`), not left to the copy — wrapping is what once
  turned this 38px band into a 92px block above the sticky header.
- Optional separator dot or pipe between phrases.
- Phrases are revealed by content-driven breakpoints, each measured from the
  phrase's natural single-line width including the 32px horizontal padding:

  | Width | Phrases shown | Line needs | Slack |
  | ----- | ------------- | ---------- | ----- |
  | `< sm` (<640px) | none — bar hidden | — | — |
  | `sm` (≥640px) | 1 | 377px | 246px |
  | ≥800px | 1–2 | 738px | 45px |
  | ≥1080px | all 3 | 1000px | 63px |

  Slack is measured against a 17px classic scrollbar. The two upper tiers are
  deliberately *not* `md` (768px) and `lg` (1024px): those leave 13px and 9px,
  thin enough to clip on a machine whose scrollbar or Inter fallback renders a
  hair wider. Content-driven numbers beat tier names here.

  The `sm`-and-below hide is not optional here: even one phrase overruns a
  375px phone line, and the 92px result stacked on the 65px header consumed
  19% of the viewport before any content. Nothing is lost — curation
  headlines the home hero, "Envío no incluido" is disclosed in full at the
  cart total, and every price already renders COP.
- A new phrase goes behind a breakpoint wide enough to seat it. Measure the
  natural single-line width first; do not append to an existing tier.

### Nav (`<nav>`)

- Sticky, `top: 0`, `z-50`. Background `rgba(246,243,238,.92)` with
  `backdrop-filter: saturate(180%) blur(14px)`.
- Hairline bottom border `--color-line`.
- Logo: Fraunces 28px, weight 500, letter-spacing `-0.03em`. Trailing letter
  wrapped in `<i>` to italicize and color terracotta.
- Nav links: 14px Inter weight 500, gap 36px. Hover: 60% opacity, animated
  underline 0→100% width in 300ms.
- Right actions: search/heart icon buttons (40px round), then a cart pill
  (`background --color-ink`, dot in terracotta with item count).
- Mobile (`sm` and below): hide nav links, show menu trigger that opens a
  full-width sheet. (The existing `Header` already implements this with
  `data-testid="mobile-menu-trigger"`.)

### Button

Pill button is the signature. Two variants in the marketing surface; five
in-app.

- `primary` (marketing) — `--color-ink` background, `--color-paper` text,
  radius 9999px, padding `16px 28px`, font 14px weight 500. Hover: lift
  -2px, change bg to `--color-ink-2`. Arrow inside shifts +4px on hover.
- `ghost` — transparent, 1px border `--color-ink`, text `--color-ink`. Hover:
  invert (ink bg, paper text).
- In-app: keep the existing `Button` component variants (`primary`,
  `secondary`, `danger`, `ghost`, `accent`) but expose a `pill` boolean that
  switches to radius 9999px and the marketing padding. Default stays
  `rounded-md`.
- `accent` is the terracotta conversion CTA (Login, Signup, Cart checkout,
  add-to-cart, save-profile, publish-listing, admin approve). It renders
  `--color-terracotta-deep` background with `--color-paper` text, not plain
  `--color-terracotta` — the base accent under either paper or ink text
  misses 4.5:1 at button text sizes. Hover/active darken with a brightness
  filter (95%, then 90%) rather than fading toward the page background,
  since fading would erode the already-tight contrast margin; the deeper
  90% active step (vs. the other variants' 5%) keeps a distinct pressed
  cue while staying ≥4.5:1 (~4.93:1).

States:

- Default, hover, focus-visible (2px ring, offset 2, color `--color-ink`),
  active (5% darker), disabled (50% opacity, `cursor-not-allowed`),
  loading (spinner replaces label; the existing `Spinner` is acceptable).

### Pill filter (chips)

`padding: 10px 20px; border-radius: 9999px;` transparent bg, 1px border
`--color-line-2`. Hover or active: bg `--color-ink`, color `--color-paper`,
border matches.

### Card

In-app cards stay as today (radius `0.5rem`, `border-border`, `shadow-sm`).
On the marketing surface, large cards switch to radius `18px` and remove
the default border, replacing it with the soft shadow.

### Product card

- Image frame: `aspect-ratio: 3/4`, radius 14, bg `--color-paper-3`.
- Hover: card translates -4px, image scales 1.05 over 600ms.
- Top-left tag: 5px 10px pill, 10px uppercase, weight 600. Variants:
  `new` (terracotta bg / paper text) and `sale` (ink bg / paper text).
- Top-right heart: 44px round (touch-target minimum), `--color-paper`/95%
  bg, transitions to `bg-white` + `scale 1.1` on hover.
- Meta: name (14px / 500), brand (11px uppercase, letter-spacing `.08em`,
  color `--color-muted`), price in Fraunces 18px, optional strike-through
  in `--color-muted-3` 13px.

### Category tile

- `aspect-ratio: 1/1.2`, radius 18, gradient overlay bottom→top
  (transparent 30% → `rgba(0,0,0,.7)` 100%).
- Title (Fraunces 30px) and count (13px / 85% opacity) sit bottom-left.
- Image hover: scale 1.06 over 800ms.
- Grid uses 12-col span. Desktop: spans 5/4/3 then 3/5/4. Tablet: all span 3.
  Mobile: 2-col grid, all span 1.

### Hero

- Two-column grid `1.15fr 1fr`, gap 48, align end.
- Display `h1` clamps 56–148px. The phrase "lo que compras" uses the strike
  class to be visually crossed out.
- Subhead: 16px `--color-muted-2`, line-height 1.65, max 420px.
- Meta row: 1px top border, 32px gap, three stats (Fraunces 30px number +
  13px caption).
- Visual: 640px tall. Two overlapping images, radii 18, soft shadow. Top-left
  "Live" badge with pulsing dot. Bottom-right discount card (`-65%`) on ink.

### Story / Sustainability

- Full-bleed `--color-ink` background, `--color-paper` text.
- Decorative `♻` glyph (520px) in top-right at 8% terracotta opacity.
- Two-column grid (1fr 1fr), gap 80.
- Stats: 2-col grid, terracotta number (Fraunces 64px), muted caption.
- Image pill at bottom: 95% paper bg, terracotta icon disc, title + caption.

### How-it-works step

Three cards. Each is a 40px-padded card with a step number (Fraunces 80px
italic at 12% ink opacity), title (Fraunces 28px), body, and tag pill
(terracotta, 11px uppercase letter-spacing `.12em`).

- Step 1: bg `--color-paper-2`.
- Step 2: bg `--color-paper-3` (slightly darker).
- Step 3: bg `--color-ink`, text `--color-paper`. Number in 15% paper
  opacity, body in 70% paper opacity.

The three cards are an `<ol role="list">` of `<li>`, not a grid of divs. The
step number is decoration and carries `aria-hidden` — unhidden it makes a
screen reader announce "cero uno" before every title — so the ordering has to
survive in the markup instead. `role="list"` is required: the list-style is
none, and Safari drops list semantics without it.

### Editorial card

- Single card with 60px padding, radius 24, bg `--color-paper-2`.
- Two-column grid, gap 60.
- Eyebrow → headline (Fraunces 54px) → body → primary button.
- Image: 520px tall, radius 18.

### Testimonial

- Cards `bg --color-paper-2`, radius 18, padding 32, min-height 340.
- Stars terracotta, letter-spacing 2px.
- Quote Fraunces 22px / 1.35.
- Author: 44px round avatar, name 14/600, location 12/muted.

### Newsletter CTA

- Full-bleed `--color-terracotta`, text `--color-paper`.
- Headline 40–68px clamp with one italic word.
- Form: pill container 6px padding, transparent 15% paper bg. Email input
  takes the rest, button is dark ink pill.
- Mobile: stack form vertically, full-width inputs, rounded 18px container.
- Footnote: 12px, 70% opacity, letter-spacing `.04em`.

### Footer

- Full-bleed `--color-ink`, padding 80/0/32.
- Four columns: brand (1.5fr) + three link groups (1fr each). 48 gap, 60
  bottom margin.
- Brand column: Fraunces 36px logo, 14px muted copy, social row of 40px
  round outlined buttons. Hover: terracotta bg.
- Column headers: Inter 12px / 600 / letter-spacing `.15em` / uppercase /
  50% paper opacity.
- Column links: 14px / 85% paper. Hover is `--color-terracotta-light`, not
  plain terracotta: on ink the base accent reads 4.36:1, under the 4.5:1
  floor for 14px text; the light step reads 5.31:1.
- Bottom row: 1px top border, 12px, flex between, gap 16. The 60% dimming
  sits on each child (`text-paper/60`), never on the row. `opacity` below 1
  composites the whole subtree at once, so a container-level 60% makes every
  descendant hover and focus ring unreachable — the links then brighten to
  full `--color-paper` on hover (6.36:1 → 15.72:1).

### Badge

- Inherits the existing `Badge` component. Variants `default | primary |
  success | warning | danger | info`. The "Pending" product state uses
  `warning`; orders display through `ORDER_STATUS_LABEL` in Spanish.
- Marketing surface adds two tag variants: `new` (terracotta) and `sale`
  (ink). They are visual tags, not state badges.

### Form fields

Inputs follow the existing `Input`, `Textarea`, `Select` (height 40, radius
`rounded-md`, border `--color-control`). The `sell` form price field uses
`step="1"` to match the backend DTO; do not tighten it.

The boundary is `--color-control`, never `--color-border`. A card hairline
(`--color-line`, ink at 10%) reads 1.22:1 on paper: fine as decoration, but it
is the only thing that says "this is a field", and WCAG 2.2 SC 1.4.11 puts
that at 3:1. `--color-control` clears it on every paper surface (3.87 on
`--color-paper`, 3.54 on `--color-paper-2`, 3.27 on `--color-paper-3`). This
applies to raw `<input>`s outside the shared components too, including the
`file:` pseudo-element of the two file pickers (`sell`, order dispute).

### Focus states

All interactive elements must show a visible focus ring (2px, color
`--color-ink`, 2px offset, surface-color spacer) — handled today by
`.focus-ring` and by the `Button` component's `focus-visible:ring-2`.

## Accessibility requirements and testable criteria

Targets WCAG 2.2 AA, keyboard-first, full keyboard reachability.

- All text on `--color-paper` surfaces must reach 4.5:1 contrast against the
  surface color. Use `--color-ink` for primary text and `--color-muted-2` for
  secondary text.
- All text on `--color-ink` surfaces must reach 4.5:1 against ink. Use
  `--color-paper`. The 50% paper-opacity eyebrow is allowed only on ink
  surfaces where the resulting contrast is ≥ 4.5:1; otherwise bump to 70%.
- Terracotta on paper (`#c8623a` on `#f6f3ee`) is only ~3.6:1 — it clears
  the 3:1 large-text threshold (≥24px, e.g. the story stat numbers) but not
  the 4.5:1 normal-text one. For body text and for 11–13px labels, use
  `--color-terracotta-deep` (`#a04d2c`, ~5.3:1 on paper) instead, or back
  plain terracotta with a paper block.
- Non-text contrast (SC 1.4.11): the boundary that identifies a form control,
  and any graphic carrying meaning on its own, must reach 3:1 against its
  adjacent surface. Form controls use `--color-control`; a structural hairline
  (`--color-border`) is decoration and is exempt, so the two are not
  interchangeable.
- Every interactive element must be reachable by Tab; order matches the
  visual order. Focus ring must be visible on all variants.
- The mobile menu trigger must toggle `aria-expanded` and trap/close focus
  appropriately. The current implementation sets both — keep it.
- Form fields must have programmatic labels. The existing `Input`/`Select`
  components wire `useId()` to the `<label htmlFor>` — preserve this.
- The newsletter form must announce success with `aria-live="polite"` after
  submission.
- Image-only buttons (heart, search) require `aria-label` in Spanish.
- Color must not be the only signal for order status: keep the text label
  alongside the badge color.
- All decorative SVG use `aria-hidden`; all informative SVG have a label.
  The same applies to decorative text: oversized numerals and glyphs that
  only restate structure are hidden, and whatever they encoded moves into
  the markup (see How-it-works step).
- Deep-link targets carry `.scroll-anchor`. The header is sticky, so the
  browser aligns an anchor's top edge with the viewport's and paints the
  header straight over the heading the user was sent to. Current targets:
  `#main-content` (skip link), `#shop`, `#resenas`, `#preguntas`. The admin
  `<main>` is exempt — its header is not sticky, so an offset there would
  only drop the skip link short.

## Content and tone standards

- All visible copy is in Spanish. Keep Spanish labels in tests in sync.
- Every route carries its own `<title>`, written as `Página — Versale` and
  matching the page's own `h1` wherever one exists. Routes whose `page.tsx`
  is `"use client"` cannot export `metadata`, so each mounts a minimal
  `layout.tsx` that renders nothing but its children and supplies the title;
  `/admin` supplies the `%s · Admin — Versale` template for its sections.
  Inheriting the root title is a bug: it leaves tabs, history and bookmarks
  all reading "Versale".
- Every page has exactly one `h1`, and it renders in every state — loading
  included — not only once the data resolves.
- Voice: concise, confident, helpful. Prefer the active voice and second
  person.
- Headlines may use one italicized word in terracotta for emphasis. Never
  italicize more than one phrase.
- Sentence-case for buttons (`Iniciar sesión`, `Crear cuenta`, `Vender`).
  Title-case for nav anchors and section titles.
- Money renders through `<Price>` which uses `Intl.NumberFormat("es-CO",
  { style: "currency", currency: "COP", maximumFractionDigits: 0 })`.
- Order status labels live in `src/lib/order-status.ts` and must stay in
  Spanish: `Pendiente`, `Pagado`, `Enviado`, `Entregado`, `Cancelado`.
- The brand mark is `Versale`. The logo word may render as `versal<i>e</i>`
  in display contexts, with the trailing `e` italic and terracotta.

## Anti-patterns and prohibited implementations

- **Do not** introduce a second brand accent. The only color that means
  "Versale accent" is terracotta `#c8623a`.
- **Do not** use the prior yellow `--color-primary: #FECE14` outside the
  Admin badge context (where it survives for the "Admin" link). Migrate
  the Admin link to terracotta when convenient.
- **Do not** set display headings with Inter. The display family is
  Fraunces.
- **Do not** place terracotta text smaller than 14px on paper without
  testing contrast.
- **Do not** use `font-semibold` (600) on display text. Display is set
  with `font-weight: 400` or 500 and relies on the variable opsz axis.
- **Do not** round buttons to a small radius for marketing CTAs. The
  signature is the pill (9999px). In-app buttons keep `rounded-md`.
- **Do not** add new colors to a single component — extend the token table
  first.
- **Do not** change the sell form price `step` away from `1`. The backend
  DTO allows any positive integer.
- **Do not** translate the order status enum keys (`PENDING`, …); only the
  display labels are localized.
- **Do not** break the existing `data-testid` attributes on
  `mobile-menu-trigger` and `mobile-menu-backdrop` — the e2e suite
  depends on them.
- **Do not** dim a container with `opacity` when anything inside it has a
  hover, focus or active state. Opacity below 1 composites the subtree as
  one layer, so the descendant's own `hover:opacity-100` can never undo it
  and the focus ring is dimmed with everything else. Tint the individual
  children (`text-paper/60`) instead.

## QA checklist

Before merging any UI change, verify:

- [ ] All new colors resolve to a token from the table above.
- [ ] All new typography uses one of the listed type tokens.
- [ ] All spacing uses the 4px base scale.
- [ ] Buttons and inputs have visible `:focus-visible` rings.
- [ ] Text on every surface passes 4.5:1 contrast (or 3:1 for ≥24px).
- [ ] Spanish copy is unchanged unless a copywriter has signed off.
- [ ] e2e selectors that read Spanish labels still resolve.
- [ ] Mobile (≤640px), tablet (641–1024px), and desktop (≥1025px) layouts
      each render without horizontal scroll.
- [ ] No raw hex values appear in component files; everything is `text-*`,
      `bg-*`, `border-*` Tailwind classes that map to the tokens.
- [ ] The `Price` component renders any `Float` value as COP without
      decimals.

## Migration notes

The previous design system (Poppins, yellow + black, square radii) is being
retired in favor of the editorial Fraunces + Inter + terracotta system. To
migrate:

1. Replace `--color-primary: #FECE14` with `--color-primary: #c8623a` and
   `primary-foreground` to ink. This is already done in `globals.css` for
   the design system but legacy classes still resolve to the old tokens via
   `--color-secondary: #000000`. Keep `--color-secondary` for the dark
   button variant.
2. Add Fraunces and Inter to the font stack in `apps/web/src/app/layout.tsx`
   via `next/font`; expose as `--font-display` and `--font-sans` and wire
   into `@theme inline`.
3. Round CTA radii to 9999px via a new `pill` prop on `Button`.
4. Localize order status labels (already done in
   `apps/web/src/lib/order-status.ts`).
5. Update the home page (`apps/web/src/app/page.tsx`) to use the hero
   layout from `index.html`: oversized display headline, two overlapping
   images, a "live" pulse badge, and an editorial stats strip.
6. Update the footer (`apps/web/src/components/layout/footer.tsx`) to use
   the four-column dark layout with a brand block and three link columns.
7. Keep the e2e suite green: any selector change must update
   `e2e/tests/*.spec.ts` and the auth fixture at the same time.

## Reference

The canonical static reference for this system is `index.html` at the repo
root. When in doubt, resolve visual questions against the HTML/CSS in that
file before introducing new tokens.

<!-- TYPEUI_SH_MANAGED_START -->
# Versale Design System Skill

## Mission
You are an expert design-system author for **Versale**, a sustainable marketplace for pre-owned clothing.
Create practical, implementation-ready guidance that engineers and designers can apply directly.

## Brand
Versale — a trusted, sustainability-first C2C marketplace for second-hand fashion.
Tone: warm, confident, approachable, and eco-conscious. Not luxury, not bargain-bin.

## Style Foundations
- **Visual style**: modern, minimal, slightly editorial; photography-led; subtle border lines, generous whitespace.
- **Typography scale**: mobile-first compact scale.
  - Primary font: **Poppins** (100–900, both text and display).
  - Mono font: **IBM Plex Mono** (for prices, order numbers, SKUs).
- **Color palette**: defined as semantic tokens, not raw values.
  - **Primary** — `#FECE14` (warm Marigold, the brand accent; used sparingly for CTAs, badges, brand mark).
  - **Secondary** — `#000000` (high-contrast text and primary action background; pairs with primary in dark mode).
  - **Surface** — `#FFFFFF` (cards, page background).
  - **Text** — `#111827` (default body text).
  - **Success** — `#16A34A` (delivered, approved, in-stock).
  - **Warning** — `#D97706` (pending, in review).
  - **Danger** — `#DC2626` (errors, destructive, cancelled).
  - **Muted** — `#6B7280` (secondary text, captions).
  - **Border** — `#E5E7EB` (subtle dividers, input borders).
- **Spacing scale**: 4 / 8 / 12 / 16 / 24 / 32 px only. No off-grid values.
- **Breakpoints** (mobile-first, Tailwind defaults):
  - `sm`: 640 px — tablet portrait. Show full nav, switch grids to multi-column.
  - `md`: 768 px — tablet landscape. Switch product detail to 2-column.
  - `lg`: 1024 px — desktop. Sticky sidebar / 3-col cart summary.
  - `xl`: 1280 px — wide desktop. Cap content at `max-w-6xl`.
- **Container widths**:
  - `narrow`: `max-w-2xl` (forms, single-column pages)
  - `default`: `max-w-5xl` (orders, profile, cart)
  - `wide`: `max-w-6xl` (home, products, admin)
- **Radius scale**: 6 px (inputs/buttons), 10 px (cards), 9999 px (badges, pills).
- **Shadow scale**: `sm` for cards on hover, `md` for elevated dropdowns, none for flat content.

## Accessibility
WCAG 2.2 AA, keyboard-first interactions, visible focus states on every interactive element.
- Minimum text contrast 4.5:1 against surface.
- Focus ring: 2 px primary outline + 2 px offset on every focusable element.
- Never convey meaning with color alone — pair color with icon or text.

## Writing Tone
Concise, confident, helpful. Active voice. Sentence case for buttons and labels.
Examples: "List an item", "Add to cart", "View order", not "Add Item To Cart!!!".

## Rules: Do
- Prefer semantic tokens (e.g. `bg-surface`, `text-text-primary`) over raw values (`bg-white`, `text-zinc-900`).
- Preserve visual hierarchy: h1 > h2 > h3 with consistent size, weight, and spacing.
- Keep interaction states explicit: default, hover, focus-visible, active, disabled, loading, error.
- Use the `Card` primitive for grouping related content; never use a custom `border + padding` div.

## Rules: Don't
- Don't use low contrast text (e.g. `text-zinc-400` for body, `text-zinc-300` on white).
- Don't use off-grid spacing (`mt-[13px]`, `p-[7px]`).
- Don't write ambiguous labels ("Submit", "Click here"). Use specific verbs ("Save changes", "Place order").
- Don't use raw emoji in product UI.
- Don't ship components with `border` AND `shadow` simultaneously — pick one elevation strategy per region.

## Guideline Authoring Workflow
1. Restate the design intent in one sentence.
2. Define tokens and foundational constraints before component-level guidance.
3. Specify component anatomy, variants, states, interaction behavior.
4. Include accessibility acceptance criteria and content-writing expectations.
5. Add anti-patterns and migration notes.
6. End with a QA checklist executable in code review.

## Required Output Structure
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Required states: default, hover, focus-visible, active, disabled, loading, error.
- Interaction behavior for keyboard, pointer, touch.
- Spacing, typography, and color-token usage explicit.
- Responsive behavior and edge cases (long labels, empty states, overflow, truncation).

## Quality Gates
- Each rule must reference a token, threshold, or example — no vague adjectives.
- Every accessibility claim must be testable in implementation (axe, keyboard nav, contrast checker).
- Prefer system consistency over local optimizations.
- Flag accessibility/aesthetics conflicts and prioritize accessibility.

## Example Constraint Language
- "MUST" for non-negotiable rules, "SHOULD" for recommendations.
- Pair every "do" with at least one "don't".
- New patterns MUST include migration guidance for existing inconsistent components.

## Versale-Specific Component Notes

### Header
- Mobile (<640 px): brand + cart icon + hamburger menu (or compact Login/Sign up). No horizontal scroll.
- Tablet (≥640 px): inline nav: Browse, Cart, Orders, Sell, profile chip, Logout.
- Sticky to top with `bg-surface/95 backdrop-blur`.
- Admin chip visible at all sizes.

### Mobile Menu (Drawer)
- Trigger: hamburger button visible only on `<sm`.
- Content: Browse, Cart, Orders, Sell, Profile, Logout/Login/Signup (stacked).
- Open/close with `aria-expanded`; trap focus; close on Escape and outside click.

### Product Card
- 1:1 aspect image, 4/8/12/16 px internal padding, brand in caption (zinc-500, 12 px), price in Poppins 600 16 px.
- Hover: image scales 1.05 (300 ms), card gains `shadow-sm` (no border change).
- If out-of-stock or unapproved, badge overlays top-right (warning variant).
- Truncate title at 1 line with ellipsis; truncate description at 2 lines.

### Listing Form (Sell)
- Use 12 px gap between fields. Section title is 16 px semibold.
- Image URLs: textarea, one per line, validated client-side; reject empty / non-URL.
- Submit button is `fullWidth` on mobile, `auto` on `sm+`.

### Cart & Checkout
- 2-column layout on `lg+` (items : summary). 1-column stacked on mobile.
- Sticky summary card on `lg+` with total and CTA.
- Quantity input: 24 px wide, number type, `min=1`, `step=1`.

### Order Status Badge
- PENDING → warning, PAID → info, SHIPPED → info, DELIVERED → success, CANCELLED → danger.

### Admin Dashboard
- Stat cards in a 4-column grid (1 col mobile, 2 col `sm`, 4 col `lg`).
- Tabs: underline indicator, 2 px high, color = text-primary.
- Table-like list rows: 12 px vertical padding, divider between rows.

## Tailwind Token Mapping (Versale)

Define the following CSS custom properties in `globals.css` and map them via Tailwind v4 `@theme`:

```
--color-primary: #FECE14;
--color-primary-foreground: #111827;
--color-secondary: #000000;
--color-secondary-foreground: #FFFFFF;
--color-surface: #FFFFFF;
--color-surface-muted: #F9FAFB;
--color-text-primary: #111827;
--color-text-muted: #6B7280;
--color-text-inverse: #FFFFFF;
--color-success: #16A34A;
--color-warning: #D97706;
--color-danger: #DC2626;
--color-info: #2563EB;
--color-border: #E5E7EB;
--color-border-strong: #D1D5DB;

--font-sans: "Poppins", system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
```

Then use as Tailwind utilities: `bg-primary`, `text-text-primary`, `border-border`, etc.

## Dark Mode (Optional, future)
Versale currently ships light mode only. If dark mode is added later, surface becomes `#0A0A0A`, text becomes `#FAFAFA`, and the primary Marigold must be darkened to `#E5BD00` for AA contrast on dark surfaces.

## Migration Notes from Prior UI
- Replace `bg-zinc-900` with `bg-secondary text-text-inverse` (Button primary).
- Replace `text-zinc-500` with `text-text-muted`.
- Replace `border-zinc-300` with `border-border`.
- Replace `font-sans` (Geist) with `font-sans` (Poppins).
- Replace `font-mono` (Geist Mono) with `font-mono` (IBM Plex Mono).
- Remove `dark:` variants until dark mode is officially supported (avoid dead code).

<!-- TYPEUI_SH_MANAGED_END -->

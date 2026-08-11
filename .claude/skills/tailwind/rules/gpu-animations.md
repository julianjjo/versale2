---
title: GPU-Accelerated Animations
impact: MEDIUM
tags: animation, transition, transform, performance
---

**Rule**: Flag `transition-all` only when it's paired with a hover/state change to a layout-triggering property (`width`, `height`, `margin`, or `padding`) — scope the transition to that property instead. Don't flag `transition-all` when the only properties that change are `transform` or `opacity`; those are already GPU-accelerated and don't trigger layout recalculation.

### Incorrect

```tsx
<div className="transition-all hover:ml-4">
<div className="transition-all duration-300 hover:w-64">
```

### Correct

```tsx
<div className="transition-transform hover:translate-x-4">
<div className="transition-[width] duration-300 hover:w-64">

<!-- transition-all is fine here — only transform/opacity change -->
<div className="transition-all hover:scale-105 hover:opacity-80">
```

Prefer animating `transform` and `opacity` over `width`, `height`, `margin`, or `padding`.

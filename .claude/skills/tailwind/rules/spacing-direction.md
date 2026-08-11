---
title: Spacing Direction — Bottom Only
impact: HIGH
tags: spacing, margin, padding, gap
---

**Rule**: Prefer `mb-*`/`pb-*` for spacing between sibling elements. Allow `mt-*`/`pt-*` when top-side spacing is intentional (e.g. spacing from a sticky/fixed ancestor, or a component controlling its own leading space). In flex or grid layouts, prefer `gap` on the parent over margins on children.

### Incorrect

```tsx
<div className="mt-4 pt-4">
  <h2 className="mt-6">Title</h2>
  <p className="mt-2">Content</p>
</div>
```

### Correct

```tsx
<div className="mb-4 pb-4">
  <h2 className="mb-2">Title</h2>
  <p>Content</p>
</div>

<!-- Or use gap on parent -->
<div className="flex flex-col gap-4">
  <h2>Title</h2>
  <p>Content</p>
</div>
```

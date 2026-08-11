---
title: Use jest.unstable_mockModule for ESM
impact: MEDIUM
description: jest.mock() does not work with native ES modules. Use jest.unstable_mockModule with dynamic import() for ESM mocking.
tags: module, esm, unstable_mockModule, import, dynamic-import
---

# Use jest.unstable_mockModule for ESM

## Problem

`jest.mock()` relies on CommonJS hoisting semantics. In native ES module mode (`"type": "module"` or `.mjs` files), `jest.mock()` cannot hoist above static `import` statements. The mock is registered after the module is already imported, so the real module is used instead.

## Incorrect

```javascript
// BUG: jest.mock does not work with static ESM imports
import { fetchUser } from './api.mjs';

jest.mock('./api.mjs'); // too late — import already resolved

test('mocks fetchUser', () => {
  fetchUser.mockReturnValue({ id: 1 }); // TypeError: mockReturnValue is not a function
});
```

## Correct

```javascript
// Use jest.unstable_mockModule + dynamic import
// ESM has no implicit jest global — import every Jest API you use
import { jest, test, expect, beforeEach } from '@jest/globals';

beforeEach(async () => {
  // Reset the ESM module registry first — without this, Jest can return a
  // previously cached module and ignore this test's mock factory.
  jest.resetModules();
  jest.unstable_mockModule('./api.mjs', () => ({
    fetchUser: jest.fn(),
  }));
});

test('mocks fetchUser', async () => {
  const { fetchUser } = await import('./api.mjs');
  fetchUser.mockReturnValue({ id: 1 });
  expect(fetchUser()).toEqual({ id: 1 });
});
```

```javascript
// Full mock — mock every export explicitly instead of importing the real
// module from inside its own mock factory. `await import('./utils.mjs')`
// inside the factory for './utils.mjs' resolves to the same mocked
// specifier and re-enters the factory, which hangs the test instead of
// loading the real module. Partial ESM mocking this way is unsupported.
import { jest, test, expect } from '@jest/globals';

test('full ESM mock', async () => {
  jest.unstable_mockModule('./utils.mjs', () => ({
    formatDate: jest.fn(() => '2024-01-01'),
    formatCurrency: jest.fn((amount) => `$${amount.toFixed(2)}`),
  }));

  const { formatDate, formatCurrency } = await import('./utils.mjs');
  expect(formatDate()).toBe('2024-01-01');
  expect(formatCurrency(1234.5)).toBe('$1234.50');
});
```

## Key Differences from jest.mock

| Feature | `jest.mock` (CJS) | `jest.unstable_mockModule` (ESM) |
|---|---|---|
| Hoisting | Auto-hoisted above imports | Not hoisted |
| Import style | `require()` or static `import` | Must use `await import()` |
| Factory | Synchronous | Can be `async` |
| API stability | Stable | Unstable (API may change) |
| Module resolution | After mock registration | After mock registration |

## Why

- ESM has static module linking — imports are resolved before any code runs, so hoisting is not possible.
- `jest.unstable_mockModule` registers the mock first, then `await import()` resolves against the mock registry.
- The `unstable_` prefix indicates the API may change in future Jest versions, but it is the official approach for ESM mocking.
- If you're in a project that uses CJS (`require`), stick with `jest.mock()` — it's simpler and stable.

---
title: jest.mock factory cannot reference outer variables
impact: CRITICAL
description: Jest hoists jest.mock() calls above imports, so factory functions cannot reference variables declared in the module scope.
tags: mock, hoisting, factory, jest.mock, scope
---

# jest.mock factory cannot reference outer variables

## Problem

Jest automatically hoists `jest.mock()` calls to the top of the file, before any `import` or `require` statements. This means the factory function runs before any module-scoped variables are initialized. Referencing them causes `ReferenceError` or silently uses `undefined`.

## Incorrect

```javascript
// BUG: `user` is read directly inside the factory body (not lazily inside a
// nested callback). jest.mock() is hoisted above this file's `const user`
// declaration, so the factory runs — and reads `user` — before `user` is
// initialized.
const user = { id: 1, name: 'Alice' };

jest.mock('./userService', () => ({
  getUser: jest.fn(() => ({ id: 1, name: 'Alice' })),
  currentUser: user, // read directly here, not inside a lazy callback
}));
// ReferenceError: Cannot access 'user' before initialization
```

## Correct

```javascript
// Option 1: Inline the value inside the factory
jest.mock('./userService', () => ({
  getUser: jest.fn(() => ({ id: 1, name: 'Alice' })),
}));
```

```javascript
// Option 2: Use a variable prefixed with `mock` — Jest's special exception
const mockUser = { id: 1, name: 'Alice' };

jest.mock('./userService', () => ({
  getUser: jest.fn(() => mockUser),
}));
// Works because Jest's transform allows variables starting with `mock` to be
// referenced in factories. The prefix only bypasses that transform-time scope
// check — it does not initialize the variable early. `mockUser` still has to
// be assigned before the factory (or anything it calls) actually reads it.
```

```javascript
// Option 3: Set the return value inside each test instead
jest.mock('./userService');
const { getUser } = require('./userService');

test('returns user', () => {
  getUser.mockReturnValue({ id: 1, name: 'Alice' });
  // ...
});
```

## Why

The `mock` prefix exception exists specifically for this hoisting issue. Jest's transform (`babel-plugin-jest-hoist`) statically rejects any out-of-scope variable referenced inside a `jest.mock()` factory unless its name is prefixed with `mock` (case-insensitive) — a transform-time check, not a runtime one:

- The prefix only bypasses that check. It does **not** change when the variable is initialized — the value still isn't available until its declaration actually runs.
- A `mock`-prefixed variable initialized with a function call (e.g., `const mockUser = createUser()`) is fine, as long as nothing reads it before that call has executed.
- What actually breaks things is reading a variable — prefixed or not — before its declaration has run, such as a direct read inside the factory body when `jest.mock` is hoisted above that declaration.
- Misspelling the prefix (e.g., `mocked`, `my_mock`) fails the transform-time check regardless of initialization order.
- Native ESM has no such hoisting mechanism at all: use `jest.unstable_mockModule()` with a dynamic `import()` instead of relying on `jest.mock` hoisting (see `rules/module-esm-unstable-mock.md`).

**Safest approach**: Define the mock return value inside individual tests using `mockReturnValue` or `mockImplementation`, not in the factory.

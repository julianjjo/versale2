# Module Mocking Reference

## jest.mock — Standard Module Mock

### Auto-mock (no factory)

```javascript
jest.mock('./api');
const { fetchUser } = require('./api');
// fetchUser is now jest.fn() — returns undefined by default
```

Jest auto-generates mocks for all exports: functions become `jest.fn()`, objects are deeply mocked, classes have all methods mocked.

### Factory mock

```javascript
jest.mock('./api', () => ({
  fetchUser: jest.fn(() => ({ id: 1, name: 'Alice' })),
  fetchPosts: jest.fn(() => []),
}));
```

### Partial mock (keep some exports real)

```javascript
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  formatDate: jest.fn(() => '2024-01-01'),
}));
```

### ES module mock (with default export)

```javascript
jest.mock('./config', () => ({
  __esModule: true,
  default: { apiUrl: 'http://test.local' },
  timeout: 5000,
}));
```

## Manual Mocks — `__mocks__` Directory

### User modules

Place mock file adjacent to the real module. **Must** call `jest.mock()` to activate.

```
src/
├── utils/
│   ├── __mocks__/
│   │   └── api.js        ← manual mock
│   └── api.js             ← real module
└── app.test.js
```

```javascript
// app.test.js — must explicitly mock
jest.mock('./utils/api');
```

### Node modules

Place mock at project root adjacent to `node_modules/`. **Auto-activated** — no `jest.mock()` needed.

```
project/
├── __mocks__/
│   └── axios.js           ← auto-used for all tests
├── node_modules/
│   └── axios/
└── src/
```

### Scoped packages

```
__mocks__/
└── @scope/
    └── package.js
```

### Manual mock using createMockFromModule

```javascript
// __mocks__/fs.js
const fs = jest.createMockFromModule('fs');
fs.readFileSync.mockReturnValue('mock content');
module.exports = fs;
```

## jest.doMock — Non-Hoisted Mock

Not hoisted above imports — use for per-test mocking.

```javascript
beforeEach(() => jest.resetModules());

test('test config', () => {
  jest.doMock('./config', () => ({ env: 'test' }));
  const config = require('./config');
  expect(config.env).toBe('test');
});

test('prod config', () => {
  jest.doMock('./config', () => ({ env: 'production' }));
  const config = require('./config');
  expect(config.env).toBe('production');
});
```

## jest.isolateModules — Sandboxed Registry

Creates an isolated module registry. Modules required inside the callback get fresh instances.

```javascript
test('isolated', () => {
  jest.isolateModules(() => {
    jest.doMock('./config', () => ({ env: 'staging' }));
    const app = require('./app'); // fresh app with staging config
    expect(app.getEnv()).toBe('staging');
  });
  // registry restored — app from other tests unaffected
});
```

## jest.requireActual — Bypass Mocks

Returns the real module even when it's mocked.

```javascript
jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    dangerousFunction: jest.fn(), // only mock this one
  };
});
```

## ESM Mocking — jest.unstable_mockModule

For native ES modules (`import`/`export`). Must use `await import()` after registering the mock. ESM does not provide `jest` as an implicit global — import it (and `test`/`expect`) from `@jest/globals`.

```javascript
import { jest, test, expect } from '@jest/globals';

jest.unstable_mockModule('./api.mjs', () => ({
  fetchUser: jest.fn(() => ({ id: 1 })),
}));

test('ESM mock', async () => {
  const { fetchUser } = await import('./api.mjs');
  expect(fetchUser()).toEqual({ id: 1 });
});
```

### Async factory

An async factory can do setup work before returning the mock, but it must not import the module it is mocking — `await import('./utils.mjs')` inside the factory for `./utils.mjs` resolves to the same mocked specifier and re-enters the factory, hanging the test instead of loading the real module. Mock every export explicitly:

```javascript
jest.unstable_mockModule('./utils.mjs', async () => {
  const format = await loadFormatter(); // unrelated async setup, not the mocked module
  return { format: jest.fn(format) };
});
```

## Hoisting Behavior

| API | Hoisted | Use case |
|---|---|---|
| `jest.mock()` | Yes | Standard mocking (most common) |
| `jest.unmock()` | Yes | Undo a mock |
| `jest.doMock()` | No | Per-test mocking |
| `jest.dontMock()` | No | Per-test unmocking |

### Factory variable restrictions (hoisting)

```javascript
// FAILS: mockData is not initialized when factory runs
const mockData = { id: 1 };
jest.mock('./api', () => ({ getData: () => mockData }));

// WORKS: variables prefixed with `mock` are allowed
const mockData = { id: 1 };
jest.mock('./api', () => ({ getData: () => mockData }));
```

## Mock Verification

```javascript
jest.mock('./api');
const api = require('./api');

test('calls fetchUser', () => {
  myFunction();
  expect(api.fetchUser).toHaveBeenCalledWith(1);
  expect(api.fetchUser).toHaveBeenCalledTimes(1);
});
```

## Clearing Module Mocks

```javascript
jest.resetModules();    // module-registry cleanup — clears the require cache so the next require() loads fresh
jest.restoreAllMocks(); // spy/property restoration — restores jest.spyOn() spies and jest.replaceProperty()
                         // replacements to their originals; does not clear or reset standalone jest.fn() mocks
```

## TypeScript: Typing Mocked Modules

```typescript
jest.mock('./api');
const { fetchUser } = jest.mocked(require('./api'));
// fetchUser is typed as jest.MockedFunction<typeof fetchUser>

// Or import then cast
import { fetchUser } from './api';
jest.mock('./api');
const mockedFetchUser = jest.mocked(fetchUser);
```

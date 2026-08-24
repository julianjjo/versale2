import { describe, it, expect } from 'vitest';
import { RECENT_ORDER_WINDOW_MS } from '../page';

describe('RECENT_ORDER_WINDOW_MS', () => {
  it('is 120s idempotency window', () => {
    expect(RECENT_ORDER_WINDOW_MS).toBe(120_000);
  });
});

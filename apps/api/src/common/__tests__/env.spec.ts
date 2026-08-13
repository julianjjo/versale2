import { parsePositiveIntEnv } from '../env';

describe('parsePositiveIntEnv', () => {
  it('accepts a positive finite value', () => {
    expect(parsePositiveIntEnv('42', 10)).toBe(42);
  });

  it('falls back for an unset value', () => {
    expect(parsePositiveIntEnv(undefined, 10)).toBe(10);
  });

  it('falls back for a non-numeric value', () => {
    expect(parsePositiveIntEnv('abc', 10)).toBe(10);
  });

  it('falls back for zero', () => {
    expect(parsePositiveIntEnv('0', 10)).toBe(10);
  });

  it('falls back for a negative value — a negative number is truthy in JS, so `||` alone would not catch it', () => {
    expect(parsePositiveIntEnv('-5', 10)).toBe(10);
  });

  it('falls back for Infinity, which is finite-looking but not a usable limit', () => {
    expect(parsePositiveIntEnv('Infinity', 10)).toBe(10);
  });

  it('falls back for NaN', () => {
    expect(parsePositiveIntEnv('NaN', 10)).toBe(10);
  });

  it('falls back for an absurdly large value that no real traffic could ever reach, the same failure mode as Infinity', () => {
    expect(parsePositiveIntEnv('1e300', 10)).toBe(10);
  });

  it('accepts a large-but-realistic value used to relax the limit for automated test runs', () => {
    expect(parsePositiveIntEnv('100000', 300)).toBe(100000);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  resolvePagination,
} from '../pagination';

describe('resolvePagination', () => {
  it('defaults to page 1 and DEFAULT_PAGE_SIZE', () => {
    expect(resolvePagination(undefined, undefined)).toEqual({
      pageNum: 1,
      limitNum: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });
  it('clamps limit to MAX_PAGE_SIZE', () => {
    expect(resolvePagination(1, 999).limitNum).toBe(MAX_PAGE_SIZE);
  });
  it('handles 0 and negative as fallback', () => {
    expect(resolvePagination(0, 0).pageNum).toBe(1);
    expect(resolvePagination(-5, -10).limitNum).toBe(DEFAULT_PAGE_SIZE);
  });
  it('handles NaN and Infinity', () => {
    expect(resolvePagination(NaN, Infinity).pageNum).toBe(1);
    expect(resolvePagination(NaN, Infinity).limitNum).toBe(DEFAULT_PAGE_SIZE);
  });
  it('calculates skip correctly', () => {
    expect(resolvePagination(3, 10).skip).toBe(20);
  });
  it('clamps page to avoid overflow', () => {
    const huge = Number.MAX_SAFE_INTEGER;
    const { pageNum, skip } = resolvePagination(huge, 10);
    expect(skip).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    expect(pageNum).toBeLessThan(huge);
  });
});

import {
  resolvePagination,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../pagination';

describe('resolvePagination', () => {
  it('defaults both to 1 / DEFAULT_PAGE_SIZE when undefined', () => {
    expect(resolvePagination(undefined, undefined)).toEqual({
      pageNum: 1,
      limitNum: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it('parses valid integers', () => {
    expect(resolvePagination('2', '20')).toEqual({
      pageNum: 2,
      limitNum: 20,
      skip: 20,
    });
  });

  it('truncates fractional values', () => {
    expect(resolvePagination('2.9', '10.9').pageNum).toBe(2);
    expect(resolvePagination('1', '10.9').limitNum).toBe(10);
  });

  it('falls back on non-numeric, zero, negative, unsafe', () => {
    expect(resolvePagination('abc', undefined).pageNum).toBe(1);
    expect(resolvePagination(0, 0).pageNum).toBe(1);
    expect(resolvePagination(-5, -10).limitNum).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePagination(NaN, null).limitNum).toBe(DEFAULT_PAGE_SIZE);
  });

  it('caps limit at MAX_PAGE_SIZE', () => {
    expect(resolvePagination(1, 1000).limitNum).toBe(MAX_PAGE_SIZE);
    expect(resolvePagination(1, 100).limitNum).toBe(100);
  });

  it('clamps page so skip stays safe integer', () => {
    const { pageNum, limitNum, skip } = resolvePagination(
      Number.MAX_SAFE_INTEGER,
      10,
    );
    expect(Number.isSafeInteger(skip)).toBe(true);
    expect(limitNum).toBe(10);
    expect(pageNum).toBe(Math.floor(Number.MAX_SAFE_INTEGER / 10) + 1);
  });

  it('computes skip as (pageNum-1)*limitNum', () => {
    expect(resolvePagination(3, 10).skip).toBe(20);
    expect(resolvePagination(1, 50).skip).toBe(0);
  });

  it('handles numeric inputs directly', () => {
    expect(resolvePagination(2, 25)).toEqual({
      pageNum: 2,
      limitNum: 25,
      skip: 25,
    });
  });

  it('handles string inputs with whitespace', () => {
    expect(resolvePagination(' 2 ', ' 10 ')).toEqual({
      pageNum: 2,
      limitNum: 10,
      skip: 10,
    });
    expect(resolvePagination('   ', '   ').limitNum).toBe(10);
  });
});

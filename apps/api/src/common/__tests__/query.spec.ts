import { asRecord } from '../query';

describe('asRecord', () => {
  it('returns the object unchanged when the query is a plain record', () => {
    const query = { page: '2', limit: '20' };
    expect(asRecord(query)).toBe(query);
  });

  it('returns an empty record for null and undefined', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
  });

  // `?a[]=1` reaches the service as an array, which destructures to undefined
  // keys instead of throwing — the branch worth pinning down.
  it('returns an empty record for arrays', () => {
    expect(asRecord([])).toEqual({});
    expect(asRecord(['page', '2'])).toEqual({});
  });

  it('returns an empty record for primitives', () => {
    expect(asRecord('page=2')).toEqual({});
    expect(asRecord(42)).toEqual({});
    expect(asRecord(true)).toEqual({});
  });

  it('lets the caller destructure the narrowed record', () => {
    const { page, limit } = asRecord({ page: '3' });
    expect(page).toBe('3');
    expect(limit).toBeUndefined();
  });
});

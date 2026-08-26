import { isStaleDate } from './stale-product.calculator';

describe('isStaleDate', () => {
  it('flags items older than the threshold', () => {
    const now = new Date('2026-08-25T00:00:00Z');
    expect(isStaleDate(new Date('2026-01-01T00:00:00Z'), 180, now)).toBe(true);
    expect(isStaleDate(new Date('2026-08-01T00:00:00Z'), 180, now)).toBe(false);
  });
});

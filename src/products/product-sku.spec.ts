import { formatProductSku, initialItemTags, isProductSku } from './product-sku';

describe('formatProductSku', () => {
  it('builds a readable sequential article', () => {
    expect(formatProductSku(1)).toBe('PT-000001');
    expect(formatProductSku(42)).toBe('PT-000042');
    expect(formatProductSku(100001)).toBe('PT-100001');
  });
});

describe('isProductSku', () => {
  it('accepts PT-000001 style articles', () => {
    expect(isProductSku('PT-000001')).toBe(true);
    expect(isProductSku('pt-000042')).toBe(true);
    expect(isProductSku('2000000000001')).toBe(false);
  });
});

describe('initialItemTags', () => {
  it('numbers tags from the article', () => {
    expect(initialItemTags('PT-000001', 2)).toEqual([
      'PT-000001-01',
      'PT-000001-02',
    ]);
  });

  it('skips stock when qty is not a positive integer', () => {
    expect(initialItemTags('PT-000001', 0)).toEqual([]);
    expect(initialItemTags('PT-000001', 1.5)).toEqual([]);
  });
});

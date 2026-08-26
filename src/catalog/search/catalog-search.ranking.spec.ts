import {
  betterHit,
  escapeIlike,
  mergeSearchHits,
  promotionReason,
  sanitizeSearchQuery,
} from './catalog-search.ranking';
import { CatalogSearchHit } from './catalog-search.types';

describe('catalog-search.ranking', () => {
  it('prefers an exact SKU hit over a name hit for the same product', () => {
    const sku: CatalogSearchHit = {
      productId: 'p1',
      match: 'sku',
      score: 1,
    };
    const name: CatalogSearchHit = {
      productId: 'p1',
      match: 'name',
      score: 0.9,
    };
    expect(betterHit(name, sku).match).toBe('sku');
    expect(mergeSearchHits([[name], [sku]])).toEqual([sku]);
  });

  it('ranks SKU matches first, then name, then supplier', () => {
    const merged = mergeSearchHits([
      [{ productId: 's', match: 'supplier', score: 0.8 }],
      [{ productId: 'n', match: 'name', score: 0.2 }],
      [{ productId: 'k', match: 'sku', score: 1 }],
    ]);
    expect(merged.map((hit) => hit.productId)).toEqual(['k', 'n', 's']);
  });

  it('escapes ILIKE wildcards and strips tsquery operators', () => {
    expect(escapeIlike('100% gold_ring')).toBe('100\\% gold\\_ring');
    expect(sanitizeSearchQuery("  ring & (gold)  ")).toBe('ring gold');
  });

  it('flags promotion reasons for low stock and stale items', () => {
    expect(promotionReason(1, false, 2)).toBe('low');
    expect(promotionReason(5, true, 2)).toBe('stale');
    expect(promotionReason(1, true, 2)).toBe('low_and_stale');
    expect(promotionReason(5, false, 2)).toBeNull();
  });
});

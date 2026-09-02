import { PostgresCatalogSearchService } from './postgres-catalog-search.service';
import { CatalogSearchHit } from './catalog-search.types';

describe('PostgresCatalogSearchService', () => {
  it('returns an empty list for a blank query without hitting the database', async () => {
    const query = jest.fn();
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
      getRaw: jest.fn(),
      incr: jest.fn(),
    };
    const service = new PostgresCatalogSearchService(
      { query } as never,
      cache as never,
    );

    await expect(service.search('   ')).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('puts an exact SKU match ahead of a partial name match', async () => {
    const skuHit: CatalogSearchHit = {
      productId: 'sku-1',
      match: 'sku',
      score: 1,
    };
    const nameHit: CatalogSearchHit = {
      productId: 'name-1',
      match: 'name',
      score: 0.4,
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([skuHit])
      .mockResolvedValueOnce([nameHit])
      .mockResolvedValueOnce([]);
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      getRaw: jest.fn().mockResolvedValue('1'),
      incr: jest.fn(),
    };
    const service = new PostgresCatalogSearchService(
      { query } as never,
      cache as never,
    );

    const hits = await service.search('2000000000001');
    expect(hits[0]).toEqual(skuHit);
    expect(hits[1].match).toBe('name');
    expect(cache.set).toHaveBeenCalled();
  });

  it('still searches if Redis cache is down', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const cache = {
      get: jest.fn().mockRejectedValue(new Error('Redis is down')),
      set: jest.fn().mockRejectedValue(new Error('Redis is down')),
      getRaw: jest.fn().mockRejectedValue(new Error('Redis is down')),
      incr: jest.fn().mockRejectedValue(new Error('Redis is down')),
    };
    const service = new PostgresCatalogSearchService(
      { query } as never,
      cache as never,
    );

    await expect(service.search('кольцо')).resolves.toEqual([]);
    await expect(service.upsert({ id: 'p1', sku: 'PT-1', name: 'x', supplierId: 's1', supplierName: null })).resolves.toBeUndefined();
  });
});

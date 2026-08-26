import { ElasticsearchCatalogSearchService } from './elasticsearch-catalog-search.service';

describe('ElasticsearchCatalogSearchService', () => {
  it('keeps the same search contract and fails closed until ES is wired', async () => {
    const service = new ElasticsearchCatalogSearchService({
      get: () => undefined,
    } as never);

    await expect(service.search('ring')).rejects.toThrow(
      'ELASTICSEARCH_NODE is not configured',
    );
    await expect(
      service.upsert({
        id: 'p1',
        sku: '1',
        name: 'Ring',
        supplierId: 's1',
        supplierName: 'Acme',
      }),
    ).resolves.toBeUndefined();
  });
});

import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import { CatalogService } from './catalog.service';
import { CatalogPromotionKind } from './dto/catalog-promotions-query.dto';
import { ProductsService } from '../products/products.service';
import { StockAvailability } from '../products/enums/stock-availability.enum';

describe('CatalogService', () => {
  it('loads low-stock and stale lists for the promotions showcase', async () => {
    const products = {
      findMany: jest.fn(async (query) => ({
        data: query.stale ? ['stale'] : ['low'],
        meta: { page: 1, limit: 20, total: 1, pageCount: 1 },
      })),
    };
    const service = new CatalogService(
      {} as never,
      {} as never,
      products as unknown as ProductsService,
      {} as never,
      { get: () => 2 } as unknown as ConfigService<Env, true>,
    );

    const result = await service.promotions({});

    expect(products.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ stockStatus: StockAvailability.LOW }),
    );
    expect(products.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ stale: true }),
    );
    expect(result.lowStock?.data).toEqual(['low']);
    expect(result.stale?.data).toEqual(['stale']);
    expect(result.lowStockThreshold).toBe(2);
  });

  it('returns only stale products when kind=stale', async () => {
    const products = {
      findMany: jest.fn(async () => ({
        data: [],
        meta: { page: 1, limit: 20, total: 0, pageCount: 0 },
      })),
    };
    const service = new CatalogService(
      {} as never,
      {} as never,
      products as unknown as ProductsService,
      {} as never,
      { get: () => 180 } as unknown as ConfigService<Env, true>,
    );

    const result = await service.promotions({
      kind: CatalogPromotionKind.STALE,
    });

    expect(result.lowStock).toBeNull();
    expect(result.stale).toBeDefined();
    expect(products.findMany).toHaveBeenCalledTimes(1);
    expect(products.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ stale: true }),
    );
  });
});

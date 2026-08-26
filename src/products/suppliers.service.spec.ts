import { ConflictException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Product } from './entities/product.entity';
import { Item } from '../inventory/entities/item.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';

describe('SuppliersService.remove', () => {
  function setup(options: {
    products?: Array<{ id: string }>;
    heldCount?: number;
    soldCount?: number;
  }) {
    const itemQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(options.heldCount ?? 0),
    };
    const saleQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(options.soldCount ?? 0),
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 's1', name: 'Ювелирторг' }),
      remove: jest.fn(),
      manager: {
        find: jest.fn(async (entity: unknown) =>
          entity === Product ? (options.products ?? []) : [],
        ),
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Item) {
            return { createQueryBuilder: () => itemQb };
          }
          if (entity === SaleItem) {
            return { createQueryBuilder: () => saleQb };
          }
          return { createQueryBuilder: () => itemQb };
        }),
      },
    };
    const dataSource = { transaction: jest.fn() };
    const catalogSearch = { remove: jest.fn() };
    const service = new SuppliersService(
      repo as never,
      dataSource as never,
      catalogSearch as never,
    );
    return { service, repo, dataSource, catalogSearch };
  }

  it('blocks delete when the supplier still has goods in stock', async () => {
    const { service, repo, dataSource } = setup({
      products: [{ id: 'p1' }],
      heldCount: 2,
    });

    await expect(service.remove('s1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.remove).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('blocks delete when products already have sales', async () => {
    const { service, dataSource } = setup({
      products: [{ id: 'p1' }],
      heldCount: 0,
      soldCount: 1,
    });

    await expect(service.remove('s1')).rejects.toMatchObject({
      message: 'Cannot delete a supplier with products that have sales. Deactivate instead.',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('deletes when the supplier has no goods in stock', async () => {
    const { service, dataSource } = setup({
      products: [{ id: 'p1' }],
      heldCount: 0,
      soldCount: 0,
    });
    dataSource.transaction.mockResolvedValue(undefined);

    await service.remove('s1');
    expect(dataSource.transaction).toHaveBeenCalled();
  });
});

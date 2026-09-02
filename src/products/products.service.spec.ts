import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { Item } from '../inventory/entities/item.entity';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { ItemCategory } from './enums/item-category.enum';
import { MetalCategory } from './enums/metal-category.enum';
import { GoldTone } from './enums/gold-tone.enum';
import { ProductsService } from './products.service';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const WAREHOUSE_ID = '22222222-2222-4222-8222-222222222221';
const ADMIN = {
  id: '33333333-3333-4333-8333-333333333331',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  locationId: null,
};

describe('ProductsService.create', () => {
  function setup() {
    const savedProduct = {
      id: PRODUCT_ID,
      sku: 'PT-000001',
      name: 'Кольцо 585',
      weight: '2.350',
      metalCategory: MetalCategory.GOLD,
      goldTone: GoldTone.YELLOW,
      itemCategory: ItemCategory.RINGS,
      supplierId: 's1',
      price: null,
      costPrice: null,
      supplier: { id: 's1', name: 'Поставщик' },
    };
    const itemQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          productId: PRODUCT_ID,
          availableQty: '1',
          oldestAvailable: new Date(),
        },
      ]),
    };
    const productsRepository = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn().mockResolvedValue(savedProduct),
      findOne: jest.fn(async ({ where }: { where: { id?: string; sku?: string } }) => {
        if (where.id === PRODUCT_ID) return savedProduct;
        return null;
      }),
    };
    const suppliersRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 's1', isActive: true }),
    };
    const itemsRepository = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => itemQb),
    };
    const catalogSearch = { upsert: jest.fn().mockResolvedValue(undefined) };
    const locations = {
      getOrFail: jest.fn(),
      getOrCreateDefaultWarehouse: jest
        .fn()
        .mockResolvedValue({ id: WAREHOUSE_ID }),
      assertAccessible: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (cb: (manager: { getRepository: (entity: unknown) => unknown }) => unknown) =>
        cb({
          getRepository: (entity: unknown) => {
            if (entity === Product) return productsRepository;
            if (entity === Item) return itemsRepository;
            throw new Error('Unexpected entity');
          },
        }),
      ),
    };
    const service = new ProductsService(
      productsRepository as never,
      suppliersRepository as never,
      itemsRepository as never,
      catalogSearch as never,
      dataSource as never,
      { get: jest.fn().mockReturnValue(180) } as never,
      locations as never,
    );
    return {
      service,
      itemsRepository,
      locations,
      catalogSearch,
      productsRepository,
      dataSource,
    };
  }

  const dto: CreateProductDto = {
    sku: 'PT-000001',
    name: 'Кольцо 585',
    weight: '2.350',
    metalCategory: MetalCategory.GOLD,
    goldTone: GoldTone.YELLOW,
    itemCategory: ItemCategory.RINGS,
    supplierId: '11111111-1111-4111-8111-111111111112',
  };

  it('puts one unit in stock so catalog in_stock lists the product', async () => {
    const { service, itemsRepository, locations, dataSource } = setup();

    const created = await service.create(dto, ADMIN);

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(locations.getOrCreateDefaultWarehouse).toHaveBeenCalled();
    expect(itemsRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        uniqueTag: 'PT-000001-01',
        productId: PRODUCT_ID,
        locationId: WAREHOUSE_ID,
        status: ItemStatus.IN_STOCK,
      }),
    ]);
    expect(created.availableQty).toBe(1);
  });

  it('creates a product without price or cost', async () => {
    const { service, productsRepository } = setup();

    await service.create(dto, ADMIN);

    expect(productsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ price: null, costPrice: null }),
    );
  });

  it('still returns the product if catalog search indexing fails', async () => {
    const { service, catalogSearch } = setup();
    catalogSearch.upsert.mockRejectedValue(new Error('Redis is down'));

    await expect(service.create(dto, ADMIN)).resolves.toEqual(
      expect.objectContaining({ id: PRODUCT_ID, sku: 'PT-000001' }),
    );
  });

  it('does not leave a product when creating the stock unit fails', async () => {
    const { service, itemsRepository, dataSource } = setup();
    itemsRepository.save.mockRejectedValue(new Error('stock insert failed'));

    await expect(service.create(dto, ADMIN)).rejects.toThrow('stock insert failed');
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('does not create items when qty is 0', async () => {
    const { service, itemsRepository } = setup();

    await service.create({ ...dto, qty: 0 }, ADMIN);

    expect(itemsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate unique tags', async () => {
    const { service, itemsRepository } = setup();
    itemsRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT', [], { code: '23505' } as never),
    );

    await expect(service.create(dto, ADMIN)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('still returns the product if stock totals cannot be loaded', async () => {
    const { service, itemsRepository } = setup();
    itemsRepository.createQueryBuilder.mockImplementation(() => {
      throw new Error('stock totals failed');
    });

    await expect(service.create(dto, ADMIN)).resolves.toEqual(
      expect.objectContaining({
        id: PRODUCT_ID,
        sku: 'PT-000001',
        availableQty: 0,
        stale: false,
      }),
    );
  });
});

import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { CreateProductDto } from './dto/create-product.dto';
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
      goldTone: null,
      itemCategory: ItemCategory.RINGS,
      supplierId: 's1',
      price: '1000.00',
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
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedProduct),
    };
    const suppliersRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 's1', isActive: true }),
    };
    const itemsRepository = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => itemQb),
    };
    const catalogSearch = { upsert: jest.fn() };
    const locations = {
      getOrFail: jest.fn(),
      getOrCreateDefaultWarehouse: jest
        .fn()
        .mockResolvedValue({ id: WAREHOUSE_ID }),
      assertAccessible: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProductsService(
      productsRepository as never,
      suppliersRepository as never,
      itemsRepository as never,
      catalogSearch as never,
      { query: jest.fn() } as never,
      { get: jest.fn().mockReturnValue(180) } as never,
      locations as never,
    );
    return { service, itemsRepository, locations };
  }

  const dto: CreateProductDto = {
    sku: 'PT-000001',
    name: 'Кольцо 585',
    weight: '2.350',
    metalCategory: MetalCategory.GOLD,
    goldTone: GoldTone.YELLOW,
    itemCategory: ItemCategory.RINGS,
    supplierId: '11111111-1111-4111-8111-111111111112',
    price: '1000.00',
  };

  it('puts one unit in stock so catalog in_stock lists the product', async () => {
    const { service, itemsRepository, locations } = setup();

    const created = await service.create(dto, ADMIN);

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
});

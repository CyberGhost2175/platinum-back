import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { ItemAuditLog } from '../inventory/entities/item-audit-log.entity';
import { Item } from '../inventory/entities/item.entity';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { LocationsService } from '../locations/locations.service';
import { Product } from '../products/entities/product.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftStatus } from '../shifts/enums/shift-status.enum';
import { ShiftsService } from '../shifts/shifts.service';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { PaymentMethod } from './enums/payment-method.enum';
import { SaleStatus } from './enums/sale-status.enum';
import { SalesService } from './sales.service';

function queryBuilder(handlers: {
  getOne?: () => unknown;
  getMany?: () => unknown[];
  getRawMany?: () => unknown[];
}) {
  const qb: Record<string, unknown> = {};
  const self = () => qb;
  for (const method of [
    'setLock',
    'leftJoinAndSelect',
    'innerJoin',
    'where',
    'andWhere',
    'select',
    'orderBy',
    'take',
  ]) {
    qb[method] = jest.fn(self);
  }
  qb.getOne = jest.fn(async () => handlers.getOne?.() ?? null);
  qb.getMany = jest.fn(async () => handlers.getMany?.() ?? []);
  qb.getRawMany = jest.fn(async () => handlers.getRawMany?.() ?? []);
  return qb;
}

describe('SalesService', () => {
  const locationId = '22222222-2222-4222-8222-222222222222';
  const user: AuthUser = {
    id: 'cashier-1',
    email: 'cashier@example.com',
    role: UserRole.CASHIER,
    locationId,
  };

  let service: SalesService;
  let product: Product;
  let item: Item;
  let line: SaleItem;
  let sale: Sale;
  let shift: Shift;
  let availableCount: number;
  let itemRepo: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let productRepo: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let saleRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    findOneByOrFail: jest.Mock;
    save: jest.Mock;
  };
  let saleItemRepo: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let shiftRepo: {
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let auditRepo: { save: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    product = {
      id: 'product-1',
      outOfStock: false,
      price: '1500.00',
    } as Product;
    item = {
      id: 'item-1',
      productId: product.id,
      locationId,
      status: ItemStatus.IN_STOCK,
      deletedAt: null,
    } as Item;
    line = {
      id: 'line-1',
      saleId: 'sale-1',
      productId: product.id,
      itemId: item.id,
      qty: 1,
      price: '150000',
      discount: '0',
      discountPercent: 0,
      promoCode: null,
      lineTotal: '150000',
    } as SaleItem;
    sale = {
      id: 'sale-1',
      locationId,
      sellerId: user.id,
      shiftId: 'shift-1',
      status: SaleStatus.DRAFT,
      discount: '0',
      discountPercent: 0,
      totalAmount: '150000',
      paymentMethod: null,
      receiptNumber: null,
    } as Sale;
    shift = {
      id: 'shift-1',
      cashierId: user.id,
      locationId,
      status: ShiftStatus.OPEN,
      cashTotal: '0',
      cardTotal: '0',
    } as Shift;
    availableCount = 0;

    itemRepo = {
      createQueryBuilder: jest.fn(() =>
        queryBuilder({
          getOne: () => item,
          getMany: () => [item],
        }),
      ),
      save: jest.fn(async (row) => row),
      count: jest.fn(async () => availableCount),
    };
    productRepo = {
      createQueryBuilder: jest.fn(() =>
        queryBuilder({
          getOne: () => product,
          getMany: () => [product],
        }),
      ),
      save: jest.fn(async (row) => row),
    };
    saleRepo = {
      createQueryBuilder: jest.fn(() =>
        queryBuilder({
          getOne: () => sale,
        }),
      ),
      findOne: jest.fn(async () => ({
        ...sale,
        items: [line],
      })),
      findOneByOrFail: jest.fn(async () => sale),
      save: jest.fn(async (row) => row),
    };
    saleItemRepo = {
      createQueryBuilder: jest.fn(() =>
        queryBuilder({
          getOne: () => null,
          getRawMany: () => [],
        }),
      ),
      find: jest.fn(async () => [line]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
    };
    shiftRepo = {
      createQueryBuilder: jest.fn(() =>
        queryBuilder({
          getOne: () => shift,
        }),
      ),
      save: jest.fn(async (row) => row),
    };
    auditRepo = {
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
    };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Sale) {
          return saleRepo;
        }
        if (entity === SaleItem) {
          return saleItemRepo;
        }
        if (entity === Item) {
          return itemRepo;
        }
        if (entity === Product) {
          return productRepo;
        }
        if (entity === Shift) {
          return shiftRepo;
        }
        if (entity === ItemAuditLog) {
          return auditRepo;
        }
        throw new Error('Unexpected entity');
      }),
      query: jest.fn(async () => [{ last_value: 1 }]),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (em: typeof manager) => unknown) =>
        cb(manager),
      ),
    };
    const locations = {
      assertAccessible: jest.fn().mockResolvedValue(undefined),
      findSubtreeIds: jest.fn().mockResolvedValue([locationId]),
    };
    const shifts = {
      findOpenByCashier: jest.fn().mockResolvedValue(shift),
    };

    service = new SalesService(
      dataSource as unknown as DataSource,
      saleRepo as unknown as Repository<Sale>,
      shifts as unknown as ShiftsService,
      locations as unknown as LocationsService,
    );
  });

  it('pays a draft when the item is in stock and updates shift cash total', async () => {
    availableCount = 0;

    const paid = await service.pay('sale-1', user, {
      paymentMethod: PaymentMethod.CASH,
    });

    expect(item.status).toBe(ItemStatus.SOLD);
    expect(shift.cashTotal).toBe('150000');
    expect(shift.cardTotal).toBe('0');
    expect(sale.status).toBe(SaleStatus.PAID);
    expect(sale.paymentMethod).toBe(PaymentMethod.CASH);
    expect(sale.receiptNumber).toMatch(/^\d{8}-22222222-0001$/);
    expect(product.outOfStock).toBe(true);
    expect(paid.items[0].itemId).toBe(item.id);
  });

  it('rejects adding an item when the product is marked out of stock', async () => {
    product.outOfStock = true;

    await expect(
      service.addItem('sale-1', user, { itemId: item.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.addItem('sale-1', user, { itemId: item.id }),
    ).rejects.toThrow('Product is out of stock');
  });

  it('rejects adding an item when no available units remain', async () => {
    itemRepo.createQueryBuilder.mockImplementation(() =>
      queryBuilder({
        getOne: () => item,
        getMany: () => [],
      }),
    );

    await expect(
      service.addItem('sale-1', user, { productId: product.id, qty: 1 }),
    ).rejects.toThrow('Insufficient stock');
  });

  it('marks the product out of stock after the last unit is sold', async () => {
    availableCount = 0;
    await service.pay('sale-1', user, { paymentMethod: PaymentMethod.CARD });
    expect(product.outOfStock).toBe(true);
    expect(shift.cardTotal).toBe('150000');
  });

  it('restores stock and shift totals on refund', async () => {
    item.status = ItemStatus.SOLD;
    sale.status = SaleStatus.PAID;
    sale.paymentMethod = PaymentMethod.CASH;
    sale.totalAmount = '150000';
    shift.cashTotal = '150000';
    availableCount = 1;

    const refunded = await service.refund('sale-1', user, {
      reason: 'customer return',
    });

    expect(item.status).toBe(ItemStatus.IN_STOCK);
    expect(product.outOfStock).toBe(false);
    expect(shift.cashTotal).toBe('0');
    expect(sale.status).toBe(SaleStatus.REFUNDED);
    expect(refunded.status).toBe(SaleStatus.REFUNDED);
  });
});

import { AsyncLocalStorage } from 'async_hooks';
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

/** Simulates SELECT … FOR UPDATE: a second transaction waits until the first releases the row. */
class ExclusiveLocks {
  private readonly owners = new Map<string, symbol>();
  private readonly waiters = new Map<string, Array<() => void>>();

  async acquire(tx: symbol, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await this.acquireOne(tx, key);
    }
  }

  private acquireOne(tx: symbol, key: string): Promise<void> {
    if (this.owners.get(key) === tx) {
      return Promise.resolve();
    }
    if (!this.owners.has(key)) {
      this.owners.set(key, tx);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const list = this.waiters.get(key) ?? [];
      list.push(() => {
        this.owners.set(key, tx);
        resolve();
      });
      this.waiters.set(key, list);
    });
  }

  release(tx: symbol): void {
    for (const [key, owner] of [...this.owners.entries()]) {
      if (owner !== tx) {
        continue;
      }
      this.owners.delete(key);
      const next = this.waiters.get(key)?.shift();
      if (next) {
        next();
      }
    }
  }
}

function lockingQueryBuilder(
  locks: ExclusiveLocks,
  txAls: AsyncLocalStorage<symbol>,
  handlers: {
    getOne?: (
      params: Record<string, unknown>,
      tx: symbol,
    ) => unknown | Promise<unknown>;
    getMany?: (
      params: Record<string, unknown>,
      tx: symbol,
    ) => unknown[] | Promise<unknown[]>;
  },
) {
  const qb: Record<string, unknown> = { _params: {} };
  const self = () => qb;
  for (const method of [
    'setLock',
    'leftJoinAndSelect',
    'innerJoin',
    'select',
    'orderBy',
    'take',
  ]) {
    qb[method] = jest.fn(self);
  }
  const merge = (_sql: string, params?: Record<string, unknown>) => {
    Object.assign(qb._params as object, params);
    return qb;
  };
  qb.where = jest.fn(merge);
  qb.andWhere = jest.fn(merge);
  const tx = () => {
    const current = txAls.getStore();
    if (!current) {
      throw new Error('No active transaction');
    }
    return current;
  };
  qb.getOne = jest.fn(async () => {
    await Promise.resolve();
    return handlers.getOne?.(qb._params as Record<string, unknown>, tx()) ?? null;
  });
  qb.getMany = jest.fn(async () => {
    await Promise.resolve();
    return handlers.getMany?.(qb._params as Record<string, unknown>, tx()) ?? [];
  });
  qb.getRawMany = jest.fn(async () => []);
  return qb;
}

describe('SalesService concurrency', () => {
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
  let sales: Record<string, Sale>;
  let lines: Record<string, SaleItem>;
  let shift: Shift;
  let soldSaves: number;

  beforeEach(() => {
    const txAls = new AsyncLocalStorage<symbol>();
    const locks = new ExclusiveLocks();
    soldSaves = 0;
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
    shift = {
      id: 'shift-1',
      cashierId: user.id,
      locationId,
      status: ShiftStatus.OPEN,
      cashTotal: '0',
      cardTotal: '0',
    } as Shift;

    const makeSale = (id: string): Sale =>
      ({
        id,
        locationId,
        sellerId: user.id,
        shiftId: shift.id,
        status: SaleStatus.DRAFT,
        discount: '0',
        discountPercent: 0,
        totalAmount: '150000',
        paymentMethod: null,
        receiptNumber: null,
      }) as Sale;

    sales = {
      'sale-a': makeSale('sale-a'),
      'sale-b': makeSale('sale-b'),
    };
    lines = {
      'sale-a': {
        id: 'line-a',
        saleId: 'sale-a',
        productId: product.id,
        itemId: item.id,
        qty: 1,
        price: '150000',
        discount: '0',
        discountPercent: 0,
        promoCode: null,
        lineTotal: '150000',
      } as SaleItem,
      'sale-b': {
        id: 'line-b',
        saleId: 'sale-b',
        productId: product.id,
        itemId: item.id,
        qty: 1,
        price: '150000',
        discount: '0',
        discountPercent: 0,
        promoCode: null,
        lineTotal: '150000',
      } as SaleItem,
    };

    const itemRepo = {
      createQueryBuilder: jest.fn(() =>
        lockingQueryBuilder(locks, txAls, {
          getOne: async (params, tx) => {
            const id = String(params.id ?? params.itemId ?? item.id);
            await locks.acquire(tx, [`item:${id}`]);
            return item;
          },
          getMany: async (params, tx) => {
            const ids = (params.ids as string[] | undefined) ?? [item.id];
            await locks.acquire(
              tx,
              ids.map((id) => `item:${id}`),
            );
            return ids.map(() => item);
          },
        }),
      ),
      save: jest.fn(async (row: Item) => {
        if (row.status === ItemStatus.SOLD) {
          soldSaves += 1;
        }
        return row;
      }),
      count: jest.fn(async () => (item.status === ItemStatus.SOLD ? 0 : 1)),
    };

    const productRepo = {
      createQueryBuilder: jest.fn(() =>
        lockingQueryBuilder(locks, txAls, {
          getOne: async (_params, tx) => {
            await locks.acquire(tx, [`product:${product.id}`]);
            return product;
          },
          getMany: async (_params, tx) => {
            await locks.acquire(tx, [`product:${product.id}`]);
            return [product];
          },
        }),
      ),
      save: jest.fn(async (row) => row),
    };

    const saleRepo = {
      createQueryBuilder: jest.fn(() =>
        lockingQueryBuilder(locks, txAls, {
          getOne: async (params, tx) => {
            const id = String(params.id);
            await locks.acquire(tx, [`sale:${id}`]);
            return sales[id] ?? null;
          },
        }),
      ),
      findOne: jest.fn(async (opts: { where: { id: string } }) => {
        const sale = sales[opts.where.id];
        if (!sale) {
          return null;
        }
        return { ...sale, items: [lines[sale.id]] };
      }),
      findOneByOrFail: jest.fn(async (opts: { id: string }) => sales[opts.id]),
      save: jest.fn(async (row: Sale) => {
        sales[row.id] = row;
        return row;
      }),
    };

    const saleItemRepo = {
      createQueryBuilder: jest.fn(() =>
        lockingQueryBuilder(locks, txAls, {
          getOne: () => null,
        }),
      ),
      find: jest.fn(async (opts: { where: { saleId: string } }) => [
        lines[opts.where.saleId],
      ]),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
    };

    const shiftRepo = {
      createQueryBuilder: jest.fn(() =>
        lockingQueryBuilder(locks, txAls, {
          getOne: async (params, tx) => {
            const id = String(params.shiftId ?? params.id);
            await locks.acquire(tx, [`shift:${id}`]);
            return shift;
          },
        }),
      ),
      save: jest.fn(async (row) => row),
    };

    const auditRepo = {
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
      transaction: jest.fn(async (cb: (em: typeof manager) => unknown) => {
        const tx = Symbol();
        return txAls.run(tx, async () => {
          try {
            return await cb(manager);
          } finally {
            locks.release(tx);
          }
        });
      }),
    };

    service = new SalesService(
      dataSource as unknown as DataSource,
      saleRepo as unknown as Repository<Sale>,
      { findOpenByCashier: jest.fn().mockResolvedValue(shift) } as unknown as ShiftsService,
      {
        assertAccessible: jest.fn().mockResolvedValue(undefined),
        findSubtreeIds: jest.fn().mockResolvedValue([locationId]),
      } as unknown as LocationsService,
    );
  });

  it('sells the last unit once when two drafts pay in parallel; the second gets a stock error', async () => {
    const results = await Promise.allSettled([
      service.pay('sale-a', user, { paymentMethod: PaymentMethod.CASH }),
      service.pay('sale-b', user, { paymentMethod: PaymentMethod.CASH }),
    ]);

    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    const rejected = results.filter((row) => row.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].status).toBe('rejected');
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
      expect((rejected[0].reason as Error).message).toMatch(
        /not available for sale|out of stock/i,
      );
    }
    expect(item.status).toBe(ItemStatus.SOLD);
    expect(soldSaves).toBe(1);
    expect(Number(shift.cashTotal)).toBe(150000);
    expect(product.outOfStock).toBe(true);
  });

  it('rejects a second concurrent pay of the same draft', async () => {
    const results = await Promise.allSettled([
      service.pay('sale-a', user, { paymentMethod: PaymentMethod.CARD }),
      service.pay('sale-a', user, { paymentMethod: PaymentMethod.CARD }),
    ]);
    const rejected = results.filter((row) => row.status === 'rejected');
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === 'rejected') {
      expect((rejected[0].reason as Error).message).toBe(
        'Receipt is already finalized',
      );
    }
    expect(item.status).toBe(ItemStatus.SOLD);
  });

  it('rejects a second concurrent refund', async () => {
    item.status = ItemStatus.SOLD;
    sales['sale-a'].status = SaleStatus.PAID;
    sales['sale-a'].paymentMethod = PaymentMethod.CASH;
    sales['sale-a'].totalAmount = '150000';
    shift.cashTotal = '150000';

    const results = await Promise.allSettled([
      service.refund('sale-a', user, { reason: 'first' }),
      service.refund('sale-a', user, { reason: 'second' }),
    ]);

    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((row) => row.status === 'rejected');
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === 'rejected') {
      expect((rejected[0].reason as Error).message).toBe(
        'Only a paid receipt can be refunded',
      );
    }
    expect(item.status).toBe(ItemStatus.IN_STOCK);
    expect(shift.cashTotal).toBe('0');
  });
});

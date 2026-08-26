import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AsyncLocalStorage } from 'async_hooks';
import { AuthUser } from '../auth/types/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { LocationsService } from '../locations/locations.service';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { SaleStatus } from '../sales/enums/sale-status.enum';
import { Shift } from './entities/shift.entity';
import { ShiftStatus } from './enums/shift-status.enum';
import { ShiftsService } from './shifts.service';

describe('ShiftsService', () => {
  const locationId = '22222222-2222-4222-8222-222222222222';
  const user: AuthUser = {
    id: 'cashier-1',
    email: 'cashier@example.com',
    role: UserRole.CASHIER,
    locationId,
  };

  let service: ShiftsService;
  let shiftsRepository: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let salesRepository: { find: jest.Mock; count: jest.Mock; remove: jest.Mock };
  let saleItemsRepository: { delete: jest.Mock };
  let locations: { assertAccessible: jest.Mock; getOrFail: jest.Mock };
  let manager: { getRepository: jest.Mock };

  const paidReceipts = [
    {
      status: SaleStatus.PAID,
      totalAmount: '150000',
      items: [{ qty: 1 }],
    },
    {
      status: SaleStatus.PAID,
      totalAmount: '50000',
      items: [{ qty: 1 }, { qty: 1 }],
    },
  ];

  beforeEach(() => {
    shiftsRepository = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(async (row) => ({ id: 'shift-1', ...row })),
      create: jest.fn((row) => row),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    salesRepository = {
      find: jest.fn(async (options?: { where?: { status?: SaleStatus } | Array<unknown> }) => {
        const where = options?.where;
        if (where && !Array.isArray(where) && where.status === SaleStatus.DRAFT) {
          return [];
        }
        return paidReceipts;
      }),
      count: jest.fn().mockResolvedValue(0),
      remove: jest.fn(async (rows) => rows),
    };
    saleItemsRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    locations = {
      assertAccessible: jest.fn().mockResolvedValue(undefined),
      getOrFail: jest.fn().mockResolvedValue({ id: locationId }),
    };
    manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Shift) {
          return shiftsRepository;
        }
        if (entity === Sale) {
          return salesRepository;
        }
        if (entity === SaleItem) {
          return saleItemsRepository;
        }
        throw new Error(`Unexpected entity ${entity?.name}`);
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (em: typeof manager) => unknown) =>
        cb(manager),
      ),
    };
    service = new ShiftsService(
      dataSource as unknown as DataSource,
      shiftsRepository as unknown as Repository<Shift>,
      salesRepository as unknown as Repository<Sale>,
      locations as unknown as LocationsService,
    );
  });

  it('rejects opening a second shift for the same cashier', async () => {
    shiftsRepository.findOne.mockResolvedValue({
      id: 'open-shift',
      cashierId: user.id,
      status: ShiftStatus.OPEN,
    });

    await expect(service.open(user, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.open(user, {})).rejects.toThrow(
      'Cashier already has an open shift; close it first',
    );
  });

  it('closes a shift with the correct cash/card summary', async () => {
    const shift = {
      id: 'shift-1',
      cashierId: user.id,
      locationId,
      status: ShiftStatus.OPEN,
      cashTotal: '150000',
      cardTotal: '50000',
    };
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(shift),
    };
    shiftsRepository.createQueryBuilder.mockReturnValue(qb);
    shiftsRepository.save.mockImplementation(async (row) => row);
    shiftsRepository.findOneOrFail.mockImplementation(async () => ({
      ...shift,
      cashier: { id: user.id },
      location: { id: locationId },
    }));

    const closed = await service.close('shift-1', user);

    expect(closed.status).toBe(ShiftStatus.CLOSED);
    expect(closed.closedAt).toBeInstanceOf(Date);
    expect(closed.summary).toEqual({
      cashTotal: 150000,
      cardTotal: 50000,
      grandTotal: 200000,
      receiptsCount: 2,
      averageCheck: 100000,
      soldItemsCount: 3,
    });
    expect(closed.receipts).toHaveLength(2);
  });

  it('discards unpaid drafts when closing a shift', async () => {
    const shift = {
      id: 'shift-1',
      cashierId: user.id,
      locationId,
      status: ShiftStatus.OPEN,
      cashTotal: '0',
      cardTotal: '0',
    };
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(shift),
    };
    shiftsRepository.createQueryBuilder.mockReturnValue(qb);
    shiftsRepository.save.mockImplementation(async (row) => row);
    shiftsRepository.findOneOrFail.mockImplementation(async () => ({
      ...shift,
      cashier: { id: user.id },
      location: { id: locationId },
    }));
    const draft = { id: 'draft-1', status: SaleStatus.DRAFT, shiftId: shift.id };
    salesRepository.find.mockImplementation(
      async (options?: { where?: { status?: SaleStatus } | Array<unknown> }) => {
        const where = options?.where;
        if (where && !Array.isArray(where) && where.status === SaleStatus.DRAFT) {
          return [draft];
        }
        return [];
      },
    );

    const closed = await service.close('shift-1', user);

    expect(saleItemsRepository.delete).toHaveBeenCalledWith({
      saleId: expect.anything(),
    });
    expect(salesRepository.remove).toHaveBeenCalledWith([draft]);
    expect(closed.status).toBe(ShiftStatus.CLOSED);
  });

  it('rejects a second concurrent close of the same shift', async () => {
    const txAls = new AsyncLocalStorage<symbol>();
    const waiters: Array<() => void> = [];
    let owner: symbol | undefined;

    const acquire = (tx: symbol) => {
      if (owner === tx) {
        return Promise.resolve();
      }
      if (!owner) {
        owner = tx;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        waiters.push(() => {
          owner = tx;
          resolve();
        });
      });
    };
    const release = (tx: symbol) => {
      if (owner !== tx) {
        return;
      }
      owner = undefined;
      const next = waiters.shift();
      if (next) {
        next();
      }
    };

    const shift = {
      id: 'shift-1',
      cashierId: user.id,
      locationId,
      status: ShiftStatus.OPEN,
      cashTotal: '0',
      cardTotal: '0',
    };
    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => {
        await Promise.resolve();
        const tx = txAls.getStore();
        if (tx) {
          await acquire(tx);
        }
        return shift;
      }),
    };
    shiftsRepository.createQueryBuilder.mockReturnValue(qb);
    shiftsRepository.save.mockImplementation(async (row) => row);
    shiftsRepository.findOneOrFail.mockImplementation(async () => ({
      ...shift,
      cashier: { id: user.id },
      location: { id: locationId },
    }));
    salesRepository.count.mockResolvedValue(0);
    salesRepository.find.mockResolvedValue([]);

    const dataSource = {
      transaction: jest.fn(async (cb: (em: typeof manager) => unknown) => {
        const tx = Symbol();
        return txAls.run(tx, async () => {
          try {
            return await cb(manager);
          } finally {
            release(tx);
          }
        });
      }),
    };
    const concurrent = new ShiftsService(
      dataSource as unknown as DataSource,
      shiftsRepository as unknown as Repository<Shift>,
      salesRepository as unknown as Repository<Sale>,
      locations as unknown as LocationsService,
    );

    const results = await Promise.allSettled([
      concurrent.close('shift-1', user),
      concurrent.close('shift-1', user),
    ]);

    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((row) => row.status === 'rejected');
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
      expect((rejected[0].reason as Error).message).toBe(
        'Shift is already closed',
      );
    }
    expect(shift.status).toBe(ShiftStatus.CLOSED);
  });
});

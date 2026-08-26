import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { LocationsService } from '../locations/locations.service';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { SaleStatus } from '../sales/enums/sale-status.enum';
import { OpenShiftDto } from './dto/open-shift.dto';
import { Shift } from './entities/shift.entity';
import { ShiftStatus } from './enums/shift-status.enum';
import { emptyShiftTotals } from './shift-totals.calculator';
import { buildShiftSummary, ShiftSummary } from './shift-summary.calculator';

export type ShiftState = Shift & {
  summary: ShiftSummary;
  receipts: Sale[];
};

@Injectable()
export class ShiftsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Shift)
    private readonly shiftsRepository: Repository<Shift>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    private readonly locations: LocationsService,
  ) {}

  findAll(locationId?: string): Promise<Shift[]> {
    return this.shiftsRepository.find({
      where: locationId ? { locationId } : undefined,
      relations: { cashier: true, location: true },
      order: { openedAt: 'DESC' },
      take: 50,
    });
  }

  async getById(id: string, user: AuthUser): Promise<ShiftState> {
    const shift = await this.shiftsRepository.findOne({
      where: { id },
      relations: { cashier: true, location: true },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    await this.locations.assertAccessible(user, shift.locationId);
    return this.toState(shift);
  }

  async getCurrent(user: AuthUser): Promise<ShiftState> {
    const shift = await this.findOpenByCashier(user.id);
    if (!shift) {
      throw new NotFoundException('No open shift');
    }
    await this.locations.assertAccessible(user, shift.locationId);
    return this.toState(shift);
  }

  async open(user: AuthUser, dto: OpenShiftDto): Promise<Shift> {
    const locationId = dto.locationId ?? user.locationId;
    if (!locationId) {
      throw new BadRequestException('locationId is required to open a shift');
    }
    await this.locations.assertAccessible(user, locationId);
    await this.locations.getOrFail(locationId);

    const existing = await this.findOpenByCashier(user.id);
    if (existing) {
      throw new BadRequestException(
        'Cashier already has an open shift; close it first',
      );
    }

    const totals = emptyShiftTotals();
    try {
      const shift = await this.shiftsRepository.save(
        this.shiftsRepository.create({
          cashierId: user.id,
          locationId,
          status: ShiftStatus.OPEN,
          openedAt: new Date(),
          closedAt: null,
          cashTotal: String(totals.cashTotal),
          cardTotal: String(totals.cardTotal),
        }),
      );
      return this.shiftsRepository.findOneOrFail({
        where: { id: shift.id },
        relations: { cashier: true, location: true },
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string } })
          .driverError?.code === '23505'
      ) {
        throw new BadRequestException(
          'Cashier already has an open shift; close it first',
        );
      }
      throw error;
    }
  }

  async close(id: string, user: AuthUser): Promise<ShiftState> {
    return this.dataSource.transaction(async (manager) => {
      const shift = await manager
        .getRepository(Shift)
        .createQueryBuilder('shift')
        .setLock('pessimistic_write')
        .where('shift.id = :id', { id })
        .getOne();
      if (!shift) {
        throw new NotFoundException('Shift not found');
      }
      await this.locations.assertAccessible(user, shift.locationId);
      if (
        shift.cashierId !== user.id &&
        user.role === UserRole.CASHIER
      ) {
        throw new BadRequestException("Cannot close another cashier's shift");
      }
      if (shift.status !== ShiftStatus.OPEN) {
        throw new BadRequestException('Shift is already closed');
      }

      const drafts = await manager.getRepository(Sale).find({
        where: { shiftId: shift.id, status: SaleStatus.DRAFT },
      });
      if (drafts.length > 0) {
        const draftIds = drafts.map((draft) => draft.id);
        await manager.getRepository(SaleItem).delete({
          saleId: In(draftIds),
        });
        await manager.getRepository(Sale).remove(drafts);
      }

      shift.status = ShiftStatus.CLOSED;
      shift.closedAt = new Date();
      await manager.getRepository(Shift).save(shift);

      const saved = await manager.getRepository(Shift).findOneOrFail({
        where: { id: shift.id },
        relations: { cashier: true, location: true },
      });
      const receipts = await this.loadReceipts(shift.id, manager.getRepository(Sale));
      return Object.assign(saved, {
        summary: this.summaryOf(saved, receipts),
        receipts,
      });
    });
  }

  findOpenByCashier(cashierId: string): Promise<Shift | null> {
    return this.shiftsRepository.findOne({
      where: { cashierId, status: ShiftStatus.OPEN },
      relations: { cashier: true, location: true },
    });
  }

  private async toState(shift: Shift): Promise<ShiftState> {
    const receipts = await this.loadReceipts(shift.id, this.salesRepository);
    return Object.assign(shift, {
      summary: this.summaryOf(shift, receipts),
      receipts,
    });
  }

  private loadReceipts(
    shiftId: string,
    repo: Repository<Sale>,
  ): Promise<Sale[]> {
    return repo.find({
      where: [
        { shiftId, status: SaleStatus.PAID },
        { shiftId, status: SaleStatus.REFUNDED },
      ],
      relations: { items: true, seller: true, customer: true },
      order: { date: 'ASC' },
    });
  }

  private summaryOf(shift: Shift, receipts: Sale[]): ShiftSummary {
    const paid = receipts.filter((sale) => sale.status === SaleStatus.PAID);
    return buildShiftSummary(
      Number(shift.cashTotal),
      Number(shift.cardTotal),
      paid.map((sale) => ({
        totalAmountMinor: Number(sale.totalAmount),
        itemsQty: (sale.items ?? []).reduce((sum, line) => sum + line.qty, 0),
      })),
    );
  }
}

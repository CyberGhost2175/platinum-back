import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { ItemAuditLog } from '../inventory/entities/item-audit-log.entity';
import { Item } from '../inventory/entities/item.entity';
import { ItemAuditAction } from '../inventory/enums/item-audit-action.enum';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { AVAILABLE_FOR_SALE } from '../inventory/inventory-stock.calculator';
import { UserRole } from '../common/enums/user-role.enum';
import { LocationsService } from '../locations/locations.service';
import { Product } from '../products/entities/product.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftStatus } from '../shifts/enums/shift-status.enum';
import {
  applyRefundToShift,
  applySaleToShift,
} from '../shifts/shift-totals.calculator';
import { ShiftsService } from '../shifts/shifts.service';
import { AddDraftItemDto } from './dto/add-draft-item.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { PayDraftDto } from './dto/pay-draft.dto';
import { RefundSaleDto } from './dto/refund-sale.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { UpdateDraftItemDto } from './dto/update-draft-item.dto';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { PaymentMethod } from './enums/payment-method.enum';
import { SaleChannel } from './enums/sale-channel.enum';
import { SaleStatus } from './enums/sale-status.enum';
import { formatReceiptNumber, utcDay } from './receipt-number';
import {
  calcLinePricing,
  calcReceiptPricing,
  mergePromoDiscount,
  resolvePromo,
  toKopecks,
} from './receipt-totals.calculator';
import {
  assertCanSellItem,
  canAddItemToDraft,
  isOutOfStockAfterSale,
  remainingAvailableAfterSale,
  restoreSoldItem,
  sellItem,
} from './sale-stock.calculator';

@Injectable()
export class SalesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    private readonly shifts: ShiftsService,
    private readonly locations: LocationsService,
  ) {}

  findAll(locationId?: string): Promise<Sale[]> {
    return this.salesRepository.find({
      where: locationId ? { locationId } : undefined,
      relations: { items: true, customer: true, shift: true, seller: true },
      order: { date: 'DESC' },
      take: 100,
    });
  }

  async getById(id: string, user: AuthUser): Promise<Sale> {
    const sale = await this.loadSale(id);
    await this.locations.assertAccessible(user, sale.locationId);
    return sale;
  }

  async createDraft(user: AuthUser, dto: CreateDraftDto): Promise<Sale> {
    const shift = await this.requireOpenShift(user);
    const locationId = dto.locationId ?? shift.locationId;
    await this.locations.assertAccessible(user, locationId);
    if (locationId !== shift.locationId) {
      throw new BadRequestException('Draft location must match the open shift');
    }

    const sale = await this.salesRepository.save(
      this.salesRepository.create({
        date: new Date(),
        receiptNumber: null,
        locationId,
        sellerId: user.id,
        shiftId: shift.id,
        customerId: dto.customerId ?? null,
        paymentMethod: null,
        channel: SaleChannel.OFFLINE,
        status: SaleStatus.DRAFT,
        promoCode: null,
        discountPercent: 0,
        discount: '0',
        totalAmount: '0',
      }),
    );
    return this.loadSale(sale.id);
  }

  async updateDraft(
    id: string,
    user: AuthUser,
    dto: UpdateDraftDto,
  ): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const sale = await this.lockDraft(manager, id, user);
      if (dto.customerId !== undefined) {
        sale.customerId = dto.customerId;
      }
      const promo = dto.promoCode !== undefined ? resolvePromo(dto.promoCode) : null;
      if (dto.promoCode !== undefined) {
        if (dto.promoCode && !promo && dto.discountMinor === undefined && dto.discountPercent === undefined) {
          throw new BadRequestException('Unknown promo code');
        }
        sale.promoCode = dto.promoCode?.trim().toUpperCase() || null;
      }
      const merged = mergePromoDiscount(
        dto.promoCode !== undefined ? promo : resolvePromo(sale.promoCode),
        dto.discountMinor,
        dto.discountPercent,
      );
      if (dto.discountMinor !== undefined || dto.promoCode !== undefined) {
        sale.discount = String(merged.discountMinor);
      }
      if (dto.discountPercent !== undefined || dto.promoCode !== undefined) {
        sale.discountPercent = merged.discountPercent;
      }
      await manager.getRepository(Sale).save(sale);
      await this.recalculate(manager, sale.id);
      return this.loadSale(sale.id, manager);
    });
  }

  async addItem(
    id: string,
    user: AuthUser,
    dto: AddDraftItemDto,
  ): Promise<Sale> {
    if (!dto.itemId && !dto.productId) {
      throw new BadRequestException('itemId or productId is required');
    }
    const qty = dto.qty ?? 1;
    if (dto.itemId && qty !== 1) {
      throw new BadRequestException('Unique jewelry items are sold with qty = 1');
    }

    return this.dataSource.transaction(async (manager) => {
      const sale = await this.lockDraft(manager, id, user);
      const items = dto.itemId
        ? [await this.lockAvailableItem(manager, dto.itemId)]
        : await this.lockAvailableByProduct(
            manager,
            dto.productId as string,
            qty,
          );

      const promo = resolvePromo(dto.promoCode);
      if (dto.promoCode && !promo && dto.discountMinor === undefined && dto.discountPercent === undefined) {
        throw new BadRequestException('Unknown promo code');
      }
      const merged = mergePromoDiscount(promo, dto.discountMinor, dto.discountPercent);

      for (const item of items) {
        await this.assertItemNotOnDraft(manager, item.id, sale.id);
        const product = await manager
          .getRepository(Product)
          .createQueryBuilder('product')
          .setLock('pessimistic_write')
          .where('product.id = :id', { id: item.productId })
          .getOne();
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        if (!canAddItemToDraft(1, product.outOfStock)) {
          throw new BadRequestException('Product is out of stock');
        }
        if (product.price === null) {
          throw new BadRequestException('Product has no price');
        }
        const unitPrice = toKopecks(product.price);
        const line = this.priceLine({
          qty: 1,
          unitPriceMinor: unitPrice,
          discountMinor: merged.discountMinor,
          discountPercent: merged.discountPercent,
        });
        await manager.getRepository(SaleItem).save(
          manager.getRepository(SaleItem).create({
            saleId: sale.id,
            productId: product.id,
            itemId: item.id,
            qty: 1,
            price: String(unitPrice),
            discount: String(merged.discountMinor),
            discountPercent: merged.discountPercent,
            promoCode: dto.promoCode?.trim().toUpperCase() || null,
            lineTotal: String(line.total),
          }),
        );
      }

      await this.recalculate(manager, sale.id);
      return this.loadSale(sale.id, manager);
    });
  }

  async updateItem(
    id: string,
    lineId: string,
    user: AuthUser,
    dto: UpdateDraftItemDto,
  ): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, id, user);
      const line = await manager.getRepository(SaleItem).findOne({
        where: { id: lineId, saleId: id },
      });
      if (!line) {
        throw new NotFoundException('Line not found');
      }
      if (dto.qty !== undefined && dto.qty !== 1) {
        throw new BadRequestException('Unique jewelry items are sold with qty = 1');
      }
      if (dto.promoCode !== undefined) {
        const promo = resolvePromo(dto.promoCode);
        if (dto.promoCode && !promo && dto.discountMinor === undefined && dto.discountPercent === undefined) {
          throw new BadRequestException('Unknown promo code');
        }
        line.promoCode = dto.promoCode?.trim().toUpperCase() || null;
      }
      const promo = resolvePromo(line.promoCode);
      const keepManual = dto.promoCode === undefined;
      const merged = mergePromoDiscount(
        promo,
        dto.discountMinor !== undefined
          ? dto.discountMinor
          : keepManual
            ? Number(line.discount)
            : undefined,
        dto.discountPercent !== undefined
          ? dto.discountPercent
          : keepManual
            ? line.discountPercent
            : undefined,
      );
      const priced = this.priceLine({
        qty: line.qty,
        unitPriceMinor: Number(line.price),
        discountMinor: merged.discountMinor,
        discountPercent: merged.discountPercent,
      });
      line.discount = String(merged.discountMinor);
      line.discountPercent = merged.discountPercent;
      line.lineTotal = String(priced.total);
      await manager.getRepository(SaleItem).save(line);
      await this.recalculate(manager, id);
      return this.loadSale(id, manager);
    });
  }

  async removeItem(id: string, lineId: string, user: AuthUser): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, id, user);
      const line = await manager.getRepository(SaleItem).findOne({
        where: { id: lineId, saleId: id },
      });
      if (!line) {
        throw new NotFoundException('Line not found');
      }
      await manager.getRepository(SaleItem).remove(line);
      await this.recalculate(manager, id);
      return this.loadSale(id, manager);
    });
  }

  async cancelDraft(id: string, user: AuthUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sale = await this.lockDraft(manager, id, user);
      await manager.getRepository(SaleItem).delete({ saleId: sale.id });
      await manager.getRepository(Sale).remove(sale);
    });
  }

  async pay(id: string, user: AuthUser, dto: PayDraftDto): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const sale = await this.lockDraft(manager, id, user);
      if (!sale.items?.length) {
        const items = await manager.getRepository(SaleItem).find({
          where: { saleId: sale.id },
        });
        sale.items = items;
      }
      if (sale.items.length === 0) {
        throw new BadRequestException('Cannot pay an empty receipt');
      }

      const shift = await this.lockShift(manager, sale.shiftId);
      if (shift.status !== ShiftStatus.OPEN) {
        throw new BadRequestException('Shift is closed');
      }

      const itemIds = sale.items
        .map((line) => line.itemId)
        .filter((value): value is string => Boolean(value));
      const lockedItems = await this.lockItemsByIds(manager, itemIds);
      const itemsById = new Map(lockedItems.map((item) => [item.id, item]));
      const productIds = [...new Set(lockedItems.map((item) => item.productId))];
      const products = await this.lockProducts(manager, productIds);
      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const line of sale.items) {
        if (!line.itemId) {
          throw new BadRequestException('Draft line is missing itemId');
        }
        const item = itemsById.get(line.itemId);
        if (!item) {
          throw new NotFoundException('Item not found');
        }
        const product = productsById.get(item.productId);
        try {
          assertCanSellItem(item.status, product?.outOfStock ?? false);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Item is not available for sale',
          );
        }
        if (!canAddItemToDraft(1, product?.outOfStock ?? false)) {
          throw new BadRequestException('Product is out of stock');
        }
        const fromStatus = item.status;
        item.status = sellItem(item.status);
        await manager.getRepository(Item).save(item);
        await manager.getRepository(ItemAuditLog).save(
          manager.getRepository(ItemAuditLog).create({
            itemId: item.id,
            action: ItemAuditAction.SOLD,
            fromStatus,
            toStatus: ItemStatus.SOLD,
            fromLocationId: item.locationId,
            toLocationId: item.locationId,
            actorUserId: user.id,
            payload: { saleId: sale.id },
          }),
        );
      }

      await this.refreshProductAvailability(manager, productIds);

      const paidAt = new Date();
      await this.recalculate(manager, sale.id);
      const priced = await manager.getRepository(Sale).findOneByOrFail({
        id: sale.id,
      });
      const amount = Number(priced.totalAmount);
      if (amount <= 0) {
        throw new BadRequestException('Receipt total must be positive');
      }

      const next = applySaleToShift(
        {
          cashTotal: Number(shift.cashTotal),
          cardTotal: Number(shift.cardTotal),
        },
        amount,
        dto.paymentMethod,
      );
      shift.cashTotal = String(next.cashTotal);
      shift.cardTotal = String(next.cardTotal);
      await manager.getRepository(Shift).save(shift);

      priced.status = SaleStatus.PAID;
      priced.paymentMethod = dto.paymentMethod;
      priced.date = paidAt;
      priced.receiptNumber = await this.nextReceiptNumber(
        manager,
        priced.locationId,
        paidAt,
      );
      await manager.getRepository(Sale).save(priced);
      return this.loadSale(priced.id, manager);
    });
  }

  async refund(id: string, user: AuthUser, dto: RefundSaleDto): Promise<Sale> {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager
        .getRepository(Sale)
        .createQueryBuilder('sale')
        .setLock('pessimistic_write')
        .where('sale.id = :id', { id })
        .getOne();
      if (!sale) {
        throw new NotFoundException('Sale not found');
      }
      sale.items = await manager.getRepository(SaleItem).find({
        where: { saleId: sale.id },
      });
      await this.locations.assertAccessible(user, sale.locationId);
      if (sale.status !== SaleStatus.PAID) {
        throw new BadRequestException('Only a paid receipt can be refunded');
      }

      const shift = await this.lockShift(manager, sale.shiftId);
      if (shift.status !== ShiftStatus.OPEN) {
        throw new BadRequestException('Cannot refund after the shift is closed');
      }

      const itemIds = (sale.items ?? [])
        .map((line) => line.itemId)
        .filter((value): value is string => Boolean(value));
      const items = await this.lockItemsByIds(manager, itemIds);
      const productIds = [...new Set(items.map((item) => item.productId))];
      await this.lockProducts(manager, productIds);
      for (const item of items) {
        const fromStatus = item.status;
        try {
          item.status = restoreSoldItem(item.status);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Cannot restore item',
          );
        }
        await manager.getRepository(Item).save(item);
        await manager.getRepository(ItemAuditLog).save(
          manager.getRepository(ItemAuditLog).create({
            itemId: item.id,
            action: ItemAuditAction.RETURNED,
            fromStatus,
            toStatus: item.status,
            fromLocationId: item.locationId,
            toLocationId: item.locationId,
            actorUserId: user.id,
            payload: {
              saleId: sale.id,
              reason: dto.reason ?? null,
            },
          }),
        );
      }

      await this.refreshProductAvailability(manager, productIds);

      const amount = Number(sale.totalAmount);
      if (amount > 0 && sale.paymentMethod) {
        try {
          const next = applyRefundToShift(
            {
              cashTotal: Number(shift.cashTotal),
              cardTotal: Number(shift.cardTotal),
            },
            amount,
            sale.paymentMethod,
          );
          shift.cashTotal = String(next.cashTotal);
          shift.cardTotal = String(next.cardTotal);
          await manager.getRepository(Shift).save(shift);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Cannot refund shift totals',
          );
        }
      }

      sale.status = SaleStatus.REFUNDED;
      await manager.getRepository(Sale).save(sale);
      return this.loadSale(sale.id, manager);
    });
  }

  private async requireOpenShift(user: AuthUser) {
    const shift = await this.shifts.findOpenByCashier(user.id);
    if (!shift) {
      throw new BadRequestException('Open a shift before creating a receipt');
    }
    return shift;
  }

  private async lockDraft(
    manager: EntityManager,
    id: string,
    user: AuthUser,
  ): Promise<Sale> {
    const sale = await manager
      .getRepository(Sale)
      .createQueryBuilder('sale')
      .setLock('pessimistic_write')
      .where('sale.id = :id', { id })
      .getOne();
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    await this.locations.assertAccessible(user, sale.locationId);
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Receipt is already finalized');
    }
    if (sale.sellerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Draft belongs to another cashier');
    }
    return sale;
  }

  private async lockShift(manager: EntityManager, shiftId: string | null) {
    if (!shiftId) {
      throw new BadRequestException('Sale is not attached to a shift');
    }
    const shift = await manager
      .getRepository(Shift)
      .createQueryBuilder('shift')
      .setLock('pessimistic_write')
      .where('shift.id = :shiftId', { shiftId })
      .getOne();
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    return shift;
  }

  private async lockAvailableItem(
    manager: EntityManager,
    itemId: string,
  ): Promise<Item> {
    const item = await manager
      .getRepository(Item)
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.id = :itemId', { itemId })
      .andWhere('item.deletedAt IS NULL')
      .getOne();
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    if (!AVAILABLE_FOR_SALE.has(item.status)) {
      throw new BadRequestException('Item is not available for sale');
    }
    return item;
  }

  private async lockAvailableByProduct(
    manager: EntityManager,
    productId: string,
    qty: number,
  ): Promise<Item[]> {
    const product = await manager
      .getRepository(Product)
      .createQueryBuilder('product')
      .setLock('pessimistic_write')
      .where('product.id = :productId', { productId })
      .getOne();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.outOfStock) {
      throw new BadRequestException('Product is out of stock');
    }

    const takenIds = await this.draftItemIds(manager);
    const qb = manager
      .getRepository(Item)
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.productId = :productId', { productId })
      .andWhere('item.deletedAt IS NULL')
      .andWhere('item.status IN (:...statuses)', {
        statuses: [...AVAILABLE_FOR_SALE],
      })
      .orderBy('item.createdAt', 'ASC')
      .take(qty);
    if (takenIds.length > 0) {
      qb.andWhere('item.id NOT IN (:...takenIds)', { takenIds });
    }
    const items = await qb.getMany();
    if (items.length < qty) {
      throw new BadRequestException('Insufficient stock');
    }
    return items;
  }

  private async lockItemsByIds(manager: EntityManager, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return manager
      .getRepository(Item)
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.id IN (:...ids)', { ids })
      .getMany();
  }

  private async lockProducts(manager: EntityManager, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return manager
      .getRepository(Product)
      .createQueryBuilder('product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...ids)', { ids })
      .getMany();
  }

  private async assertItemNotOnDraft(
    manager: EntityManager,
    itemId: string,
    saleId: string,
  ): Promise<void> {
    const existing = await manager
      .getRepository(SaleItem)
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .where('line.itemId = :itemId', { itemId })
      .andWhere('sale.status = :status', { status: SaleStatus.DRAFT })
      .getOne();
    if (existing) {
      throw new ConflictException('Item is already on a draft receipt');
    }
    const onThis = await manager.getRepository(SaleItem).findOne({
      where: { saleId, itemId },
    });
    if (onThis) {
      throw new ConflictException('Item is already on this receipt');
    }
  }

  private async draftItemIds(manager: EntityManager) {
    const rows = await manager
      .getRepository(SaleItem)
      .createQueryBuilder('line')
      .innerJoin('line.sale', 'sale')
      .select('line.itemId', 'itemId')
      .where('sale.status = :status', { status: SaleStatus.DRAFT })
      .andWhere('line.itemId IS NOT NULL')
      .getRawMany<{ itemId: string }>();
    return rows.map((row) => row.itemId);
  }

  private async refreshProductAvailability(
    manager: EntityManager,
    productIds: string[],
  ): Promise<void> {
    for (const productId of productIds) {
      const available = await manager.getRepository(Item).count({
        where: {
          productId,
          status: In([...AVAILABLE_FOR_SALE]),
        },
      });
      const product = await manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :productId', { productId })
        .getOne();
      if (!product) {
        continue;
      }
      product.outOfStock = isOutOfStockAfterSale(
        remainingAvailableAfterSale(available, 0),
      );
      await manager.getRepository(Product).save(product);
    }
  }

  private async recalculate(manager: EntityManager, saleId: string): Promise<void> {
    const sale = await manager.getRepository(Sale).findOneByOrFail({ id: saleId });
    const lines = await manager.getRepository(SaleItem).find({
      where: { saleId },
    });
    const pricedLines = lines.map((line) =>
      this.priceLine({
        qty: line.qty,
        unitPriceMinor: Number(line.price),
        discountMinor: Number(line.discount),
        discountPercent: line.discountPercent,
      }),
    );
    try {
      const receipt = calcReceiptPricing({
        lines: pricedLines,
        discountMinor: Number(sale.discount),
        discountPercent: sale.discountPercent,
      });
      sale.totalAmount = String(receipt.total);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid receipt discounts',
      );
    }
    await manager.getRepository(Sale).save(sale);
  }

  private priceLine(input: {
    qty: number;
    unitPriceMinor: number;
    discountMinor: number;
    discountPercent: number;
  }) {
    try {
      return calcLinePricing(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid line discounts',
      );
    }
  }

  private async nextReceiptNumber(
    manager: EntityManager,
    locationId: string,
    date: Date,
  ): Promise<string> {
    const day = utcDay(date);
    const rows = (await manager.query(
      `INSERT INTO receipt_sequences (location_id, day, last_value)
       VALUES ($1, $2::date, 1)
       ON CONFLICT (location_id, day)
       DO UPDATE SET last_value = receipt_sequences.last_value + 1
       RETURNING last_value`,
      [locationId, day],
    )) as Array<{ last_value: number }>;
    return formatReceiptNumber(date, locationId, Number(rows[0].last_value));
  }

  private async loadSale(id: string, manager?: EntityManager): Promise<Sale> {
    const repo = manager?.getRepository(Sale) ?? this.salesRepository;
    const sale = await repo.findOne({
      where: { id },
      relations: {
        items: { product: true, item: true },
        seller: true,
        customer: true,
        shift: true,
      },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }
}

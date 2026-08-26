import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { paginated, Paginated, resolvePagination } from '../common/pagination';
import { LocationsService } from '../locations/locations.service';
import { Product } from '../products/entities/product.entity';
import { Supplier } from '../products/entities/supplier.entity';
import { CreateStockCheckDto } from './dto/create-stock-check.dto';
import { ItemFilterQueryDto } from './dto/item-filter-query.dto';
import { MoveItemDto } from './dto/move-item.dto';
import { ReceiveBatchDto } from './dto/receive-batch.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { Batch } from './entities/batch.entity';
import { Item } from './entities/item.entity';
import { ItemAuditLog } from './entities/item-audit-log.entity';
import { StockCheck } from './entities/stock-check.entity';
import { StockCheckDiscrepancy } from './entities/stock-check-discrepancy.entity';
import {
  auditActionForStatusChange,
  ItemAuditAction,
} from './enums/item-audit-action.enum';
import { ItemStatus } from './enums/item-status.enum';
import { StockDiscrepancyKind } from './enums/stock-discrepancy-kind.enum';
import {
  applyStatusChange,
  countAvailableStock,
  PHYSICAL_ON_SITE,
  recountStockByProduct,
} from './inventory-stock.calculator';
import { diffScannedTags } from './stock-check.calculator';

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    @InjectRepository(Batch)
    private readonly batchesRepository: Repository<Batch>,
    @InjectRepository(StockCheck)
    private readonly stockChecksRepository: Repository<StockCheck>,
    private readonly locations: LocationsService,
  ) {}

  async findItems(
    query: ItemFilterQueryDto,
    user: AuthUser,
  ): Promise<Paginated<Item>> {
    const { page, limit, skip } = resolvePagination(query.page, query.limit);
    const locationId = query.locationId;
    if (locationId) {
      await this.locations.assertAccessible(user, locationId);
    }

    const qb = this.itemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('item.location', 'location')
      .leftJoinAndSelect('item.batch', 'batch')
      .andWhere('item.deletedAt IS NULL');

    if (locationId) {
      qb.andWhere('item.locationId = :locationId', { locationId });
    }
    if (query.productId) {
      qb.andWhere('item.productId = :productId', { productId: query.productId });
    }
    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }
    if (query.itemCategory) {
      qb.andWhere('product.itemCategory = :itemCategory', {
        itemCategory: query.itemCategory,
      });
    }
    if (query.metalCategory) {
      qb.andWhere('product.metalCategory = :metalCategory', {
        metalCategory: query.metalCategory,
      });
    }
    if (query.supplierId) {
      qb.andWhere('product.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      qb.andWhere(
        `(
          item.uniqueTag ILIKE :q
          OR product.sku ILIKE :q
          OR product.name ILIKE :q
          OR supplier.name ILIKE :q
          OR CAST(product.weight AS TEXT) ILIKE :q
          OR COALESCE(CAST(product.price AS TEXT), '') ILIKE :q
        )`,
        { q },
      );
    }

    const sortOrder = query.sortOrder ?? 'DESC';
    if (query.sortBy === 'name') {
      qb.orderBy('product.name', sortOrder, 'NULLS LAST');
    } else if (query.sortBy === 'price') {
      qb.orderBy('product.price', sortOrder, 'NULLS LAST');
    } else if (query.sortBy === 'sku') {
      qb.orderBy('product.sku', sortOrder, 'NULLS LAST');
    } else if (query.sortBy === 'weight') {
      qb.orderBy('product.weight', sortOrder, 'NULLS LAST');
    } else if (query.sortBy === 'supplier') {
      qb.orderBy('supplier.name', sortOrder, 'NULLS LAST');
    } else {
      qb.orderBy('item.createdAt', sortOrder);
    }

    qb.skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, page, limit);
  }

  findAll(locationId?: string): Promise<Item[]> {
    return this.itemsRepository.find({
      where: locationId ? { locationId } : undefined,
      relations: { product: true, location: true, batch: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getItem(id: string, user: AuthUser): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id },
      relations: { product: true, location: true, batch: true },
    });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    await this.locations.assertAccessible(user, item.locationId);
    return item;
  }

  async stockSummary(locationId?: string, user?: AuthUser) {
    if (locationId && user) {
      await this.locations.assertAccessible(user, locationId);
    }
    const items = await this.itemsRepository.find({
      where: locationId ? { locationId } : undefined,
      select: ['productId', 'status'],
    });
    return {
      available: countAvailableStock(items),
      byProduct: recountStockByProduct(items),
    };
  }

  async getHistory(id: string, user: AuthUser) {
    const item = await this.getItem(id, user);
    return this.dataSource.getRepository(ItemAuditLog).find({
      where: { itemId: item.id },
      order: { createdAt: 'ASC' },
    });
  }

  async receiveBatch(dto: ReceiveBatchDto, user: AuthUser): Promise<Batch> {
    const tags = dto.items.map((item) => item.uniqueTag.trim());
    if (new Set(tags).size !== tags.length) {
      throw new BadRequestException('Duplicate unique tags in the payload');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const supplier = await manager.getRepository(Supplier).findOne({
          where: { id: dto.supplierId, isActive: true },
        });
        if (!supplier) {
          throw new NotFoundException('Supplier not found');
        }

        const location = dto.locationId
          ? await this.locations.getOrFail(dto.locationId)
          : await this.locations.findDefaultWarehouse();
        await this.locations.assertAccessible(user, location.id);

        const productIds = [...new Set(dto.items.map((item) => item.productId))];
        const products = await manager.getRepository(Product).find({
          where: productIds.map((id) => ({ id })),
        });
        if (products.length !== productIds.length) {
          throw new NotFoundException('One or more products were not found');
        }

        const batch = await manager.getRepository(Batch).save(
          manager.getRepository(Batch).create({
            supplierId: supplier.id,
            receivedAt: new Date(),
            documents: [],
          }),
        );

        const items = dto.items.map((row) =>
          manager.getRepository(Item).create({
            uniqueTag: row.uniqueTag.trim(),
            productId: row.productId,
            locationId: location.id,
            batchId: batch.id,
            status: ItemStatus.IN_STOCK,
          }),
        );
        const savedItems = await manager.getRepository(Item).save(items);

        const logs = savedItems.map((item) =>
          manager.getRepository(ItemAuditLog).create({
            itemId: item.id,
            action: ItemAuditAction.CREATED,
            fromStatus: null,
            toStatus: ItemStatus.IN_STOCK,
            fromLocationId: null,
            toLocationId: location.id,
            actorUserId: user.id,
            payload: { uniqueTag: item.uniqueTag, batchId: batch.id },
          }),
        );
        await manager.getRepository(ItemAuditLog).save(logs);

        return manager.getRepository(Batch).findOneOrFail({
          where: { id: batch.id },
          relations: { items: true, supplier: true },
        });
      });
    } catch (error) {
      this.rethrowUniqueTag(error);
      throw error;
    }
  }

  async getBatch(id: string): Promise<Batch> {
    const batch = await this.batchesRepository.findOne({
      where: { id },
      relations: { items: true, supplier: true },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    return batch;
  }

  async moveItem(id: string, dto: MoveItemDto, user: AuthUser): Promise<Item> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.lockItem(manager, id);
      await this.locations.assertAccessible(user, item.locationId);
      const target = await this.locations.getOrFail(dto.locationId);
      await this.locations.assertAccessible(user, target.id);

      if (item.locationId === target.id) {
        throw new BadRequestException('Item is already at this location');
      }
      if (item.status === ItemStatus.SOLD) {
        throw new BadRequestException('Sold items cannot be moved');
      }

      const fromLocationId = item.locationId;
      item.locationId = target.id;
      const saved = await manager.getRepository(Item).save(item);

      await manager.getRepository(ItemAuditLog).save(
        manager.getRepository(ItemAuditLog).create({
          itemId: saved.id,
          action: ItemAuditAction.MOVED,
          fromStatus: saved.status,
          toStatus: saved.status,
          fromLocationId,
          toLocationId: target.id,
          actorUserId: user.id,
          payload: dto.comment ? { comment: dto.comment } : null,
        }),
      );

      return manager.getRepository(Item).findOneOrFail({
        where: { id: saved.id },
        relations: { product: true, location: true, batch: true },
      });
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateItemStatusDto,
    user: AuthUser,
  ): Promise<Item> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.lockItem(manager, id);
      await this.locations.assertAccessible(user, item.locationId);

      let next: ItemStatus;
      try {
        next = applyStatusChange(item.status, dto.status);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid status transition',
        );
      }

      const fromStatus = item.status;
      item.status = next;
      const saved = await manager.getRepository(Item).save(item);

      await manager.getRepository(ItemAuditLog).save(
        manager.getRepository(ItemAuditLog).create({
          itemId: saved.id,
          action: auditActionForStatusChange(fromStatus, next),
          fromStatus,
          toStatus: next,
          fromLocationId: saved.locationId,
          toLocationId: saved.locationId,
          actorUserId: user.id,
          payload: dto.comment ? { comment: dto.comment } : null,
        }),
      );

      return manager.getRepository(Item).findOneOrFail({
        where: { id: saved.id },
        relations: { product: true, location: true, batch: true },
      });
    });
  }

  async createStockCheck(dto: CreateStockCheckDto, user: AuthUser) {
    await this.locations.assertAccessible(user, dto.locationId);
    await this.locations.getOrFail(dto.locationId);

    return this.dataSource.transaction(async (manager) => {
      const expectedItems = await manager
        .getRepository(Item)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.locationId = :locationId', { locationId: dto.locationId })
        .andWhere('item.deletedAt IS NULL')
        .andWhere('item.status IN (:...statuses)', {
          statuses: [...PHYSICAL_ON_SITE],
        })
        .getMany();

      const expectedTags = expectedItems.map((item) => item.uniqueTag);
      const { missing, extra } = diffScannedTags(expectedTags, dto.scannedTags);
      const byTag = new Map(expectedItems.map((item) => [item.uniqueTag, item]));

      const extraItems =
        extra.length > 0
          ? await manager.getRepository(Item).find({
              where: extra.map((uniqueTag) => ({ uniqueTag })),
            })
          : [];
      const extraByTag = new Map(
        extraItems.map((item) => [item.uniqueTag, item]),
      );

      const stockCheck = await manager.getRepository(StockCheck).save(
        manager.getRepository(StockCheck).create({
          date: new Date(),
          locationId: dto.locationId,
          responsibleUserId: user.id,
        }),
      );

      const discrepancies: StockCheckDiscrepancy[] = [];
      for (const tag of missing) {
        const item = byTag.get(tag);
        discrepancies.push(
          manager.getRepository(StockCheckDiscrepancy).create({
            stockCheckId: stockCheck.id,
            kind: StockDiscrepancyKind.MISSING,
            uniqueTag: tag,
            itemId: item?.id ?? null,
            productId: item?.productId ?? null,
            expectedQty: 1,
            actualQty: 0,
            note: dto.note ?? 'Not found during scan',
          }),
        );
      }
      for (const tag of extra) {
        const item = extraByTag.get(tag);
        discrepancies.push(
          manager.getRepository(StockCheckDiscrepancy).create({
            stockCheckId: stockCheck.id,
            kind: StockDiscrepancyKind.EXTRA,
            uniqueTag: tag,
            itemId: item?.id ?? null,
            productId: item?.productId ?? null,
            expectedQty: 0,
            actualQty: 1,
            note: item
              ? `Item belongs to location ${item.locationId} with status ${item.status}`
              : 'Unknown tag',
          }),
        );
      }

      if (discrepancies.length > 0) {
        await manager.getRepository(StockCheckDiscrepancy).save(discrepancies);
      }

      return manager.getRepository(StockCheck).findOneOrFail({
        where: { id: stockCheck.id },
        relations: { discrepancies: true, location: true },
      });
    });
  }

  async getStockCheck(id: string, user: AuthUser) {
    const check = await this.stockChecksRepository.findOne({
      where: { id },
      relations: { discrepancies: true, location: true, responsibleUser: true },
    });
    if (!check) {
      throw new NotFoundException('Stock check not found');
    }
    await this.locations.assertAccessible(user, check.locationId);
    return check;
  }

  async listStockChecks(
    locationId: string | undefined,
    user: AuthUser,
  ): Promise<StockCheck[]> {
    if (locationId) {
      await this.locations.assertAccessible(user, locationId);
    }
    return this.stockChecksRepository.find({
      where: locationId ? { locationId } : undefined,
      relations: { discrepancies: true, location: true },
      order: { date: 'DESC' },
      take: 50,
    });
  }

  private async lockItem(manager: EntityManager, id: string): Promise<Item> {
    const item = await manager
      .getRepository(Item)
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.id = :id', { id })
      .andWhere('item.deletedAt IS NULL')
      .getOne();
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }

  private rethrowUniqueTag(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException('Unique tag already exists');
    }
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { CATALOG_SEARCH } from '../catalog/search/catalog-search.tokens';
import { CatalogSearchService } from '../catalog/search/catalog-search.service';
import { Batch } from '../inventory/entities/batch.entity';
import { Item } from '../inventory/entities/item.entity';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleStatus } from '../sales/enums/sale-status.enum';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { Product } from './entities/product.entity';
import { Supplier } from './entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(CATALOG_SEARCH)
    private readonly catalogSearch: CatalogSearchService,
  ) {}

  findAll(includeInactive = true): Promise<Supplier[]> {
    return this.suppliers.find({
      where: includeInactive ? undefined : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    try {
      return await this.suppliers.save(
        this.suppliers.create({
          name: dto.name.trim(),
          phone: dto.phone ?? null,
          email: dto.email?.toLowerCase() ?? null,
          isActive: true,
        }),
      );
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findById(id);
    if (dto.name !== undefined) supplier.name = dto.name.trim();
    if (dto.phone !== undefined) supplier.phone = dto.phone || null;
    if (dto.email !== undefined) {
      supplier.email = dto.email ? dto.email.toLowerCase() : null;
    }
    if (dto.isActive !== undefined) supplier.isActive = dto.isActive;
    try {
      return await this.suppliers.save(supplier);
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findById(id);
    const products = await this.suppliers.manager.find(Product, {
      where: { supplierId: id },
    });
    const productIds = products.map((product) => product.id);

    if (productIds.length > 0) {
      const heldCount = await this.suppliers.manager
        .getRepository(Item)
        .createQueryBuilder('item')
        .where('item.productId IN (:...productIds)', { productIds })
        .andWhere('item.deletedAt IS NULL')
        .andWhere('item.status != :sold', { sold: ItemStatus.SOLD })
        .getCount();
      if (heldCount > 0) {
        throw new ConflictException(
          'Cannot delete a supplier while their goods are in stock',
        );
      }

      const soldCount = await this.suppliers.manager
        .getRepository(SaleItem)
        .createQueryBuilder('line')
        .innerJoin('line.sale', 'sale')
        .where('line.productId IN (:...productIds)', { productIds })
        .andWhere('sale.status IN (:...statuses)', {
          statuses: [SaleStatus.PAID, SaleStatus.REFUNDED],
        })
        .getCount();
      if (soldCount > 0) {
        throw new ConflictException(
          'Cannot delete a supplier with products that have sales. Deactivate instead.',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      if (productIds.length > 0) {
        const draftLines = await manager
          .getRepository(SaleItem)
          .createQueryBuilder('line')
          .innerJoinAndSelect('line.sale', 'sale')
          .where('line.productId IN (:...productIds)', { productIds })
          .andWhere('sale.status = :status', { status: SaleStatus.DRAFT })
          .getMany();

        const draftSaleIds = [...new Set(draftLines.map((line) => line.saleId))];
        if (draftLines.length > 0) {
          await manager.getRepository(SaleItem).remove(draftLines);
        }
        for (const saleId of draftSaleIds) {
          const leftover = await manager.getRepository(SaleItem).count({
            where: { saleId },
          });
          if (leftover === 0) {
            const draft = await manager.getRepository(Sale).findOne({
              where: { id: saleId },
            });
            if (draft) {
              await manager.getRepository(Sale).remove(draft);
            }
          }
        }

        await manager.getRepository(Item).delete({ productId: In(productIds) });
        await manager.getRepository(Product).delete({ id: In(productIds) });
      }

      await manager.getRepository(Batch).delete({ supplierId: id });
      const current = await manager.getRepository(Supplier).findOneByOrFail({
        id: supplier.id,
      });
      await manager.getRepository(Supplier).remove(current);
    });

    await Promise.all(
      productIds.map((productId) => this.catalogSearch.remove(productId)),
    );
  }

  async count(): Promise<number> {
    return this.suppliers.count();
  }

  private rethrowUnique(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException('Supplier with this name already exists');
    }
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { Env } from '../config/env.validation';
import { Item } from '../inventory/entities/item.entity';
import { LocationsService } from '../locations/locations.service';
import { CatalogPromotionsQueryDto, CatalogPromotionKind } from './dto/catalog-promotions-query.dto';
import { ProductFilterQueryDto } from '../products/dto/product-filter-query.dto';
import { StockAvailability } from '../products/enums/stock-availability.enum';
import { ProductsService } from '../products/products.service';
import { GoldTone } from '../products/enums/gold-tone.enum';
import { ItemCategory } from '../products/enums/item-category.enum';
import { MetalCategory } from '../products/enums/metal-category.enum';
import { Supplier } from '../products/entities/supplier.entity';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { LocationType } from '../locations/enums/location-type.enum';

export interface ProductLocationStock {
  locationId: string;
  locationName: string;
  locationType: LocationType;
  availableQty: number;
  inStock: number;
  onDisplay: number;
  total: number;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    private readonly products: ProductsService,
    private readonly locations: LocationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  dictionaries() {
    return {
      metalCategories: Object.values(MetalCategory),
      goldTones: Object.values(GoldTone),
      itemCategories: Object.values(ItemCategory),
      itemStatuses: Object.values(ItemStatus),
      locationTypes: Object.values(LocationType),
      stockStatuses: Object.values(StockAvailability),
    };
  }

  suppliers(): Promise<Supplier[]> {
    return this.suppliersRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  findProducts(query: ProductFilterQueryDto) {
    return this.products.findMany(query);
  }

  findById(id: string) {
    return this.products.findById(id);
  }

  search(query: string, limit?: number) {
    return this.products.search(query, limit);
  }

  findLowStock(query: ProductFilterQueryDto) {
    return this.products.findMany({
      ...query,
      stockStatus: StockAvailability.LOW,
    });
  }

  findStale(query: ProductFilterQueryDto) {
    return this.products.findMany({
      ...query,
      stale: true,
    });
  }

  async promotions(query: CatalogPromotionsQueryDto) {
    const { kind, stale: _stale, stockStatus: _stockStatus, ...filters } =
      query;
    const threshold = this.config.get('LOW_STOCK_THRESHOLD', { infer: true });
    const staleDays = this.config.get('STALE_ITEM_DAYS', { infer: true });
    if (kind === CatalogPromotionKind.LOW) {
      return {
        lowStockThreshold: threshold,
        staleItemDays: staleDays,
        lowStock: await this.findLowStock(filters),
        stale: null,
      };
    }
    if (kind === CatalogPromotionKind.STALE) {
      return {
        lowStockThreshold: threshold,
        staleItemDays: staleDays,
        lowStock: null,
        stale: await this.findStale(filters),
      };
    }
    const [lowStock, stale] = await Promise.all([
      this.findLowStock(filters),
      this.findStale(filters),
    ]);
    return {
      lowStockThreshold: threshold,
      staleItemDays: staleDays,
      lowStock,
      stale,
    };
  }

  async stockByLocation(
    productId: string,
    user: AuthUser,
  ): Promise<ProductLocationStock[]> {
    const product = await this.products.findById(productId);

    const rows = await this.itemsRepository
      .createQueryBuilder('item')
      .innerJoin('item.location', 'location')
      .select('location.id', 'locationId')
      .addSelect('location.name', 'locationName')
      .addSelect('location.type', 'locationType')
      .addSelect(
        `SUM(CASE WHEN item.status IN ('in_stock', 'on_display') THEN 1 ELSE 0 END)`,
        'availableQty',
      )
      .addSelect(
        `SUM(CASE WHEN item.status = 'in_stock' THEN 1 ELSE 0 END)`,
        'inStock',
      )
      .addSelect(
        `SUM(CASE WHEN item.status = 'on_display' THEN 1 ELSE 0 END)`,
        'onDisplay',
      )
      .addSelect('COUNT(*)::int', 'total')
      .where('item.productId = :productId', { productId: product.id })
      .andWhere('item.deletedAt IS NULL')
      .groupBy('location.id')
      .addGroupBy('location.name')
      .addGroupBy('location.type')
      .orderBy('location.name', 'ASC')
      .getRawMany<{
        locationId: string;
        locationName: string;
        locationType: LocationType;
        availableQty: string;
        inStock: string;
        onDisplay: string;
        total: string;
      }>();

    const mapped: ProductLocationStock[] = [];
    for (const row of rows) {
      if (!(await this.locations.isAccessible(user, row.locationId))) {
        continue;
      }
      mapped.push({
        locationId: row.locationId,
        locationName: row.locationName,
        locationType: row.locationType,
        availableQty: Number(row.availableQty),
        inStock: Number(row.inStock),
        onDisplay: Number(row.onDisplay),
        total: Number(row.total),
      });
    }
    return mapped;
  }
}

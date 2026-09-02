import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { Env } from '../config/env.validation';
import { Item } from '../inventory/entities/item.entity';
import { LocationsService } from '../locations/locations.service';
import { CatalogPromotionsQueryDto, CatalogPromotionKind } from './dto/catalog-promotions-query.dto';
import { StockReportQueryDto, StockReportScope } from './dto/stock-report-query.dto';
import { ProductFilterQueryDto } from '../products/dto/product-filter-query.dto';
import { StockAvailability } from '../products/enums/stock-availability.enum';
import { ProductsService } from '../products/products.service';
import { GoldTone, goldToneOptions } from '../products/enums/gold-tone.enum';
import { ItemCategory } from '../products/enums/item-category.enum';
import { MetalCategory } from '../products/enums/metal-category.enum';
import { Supplier } from '../products/entities/supplier.entity';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { LocationType } from '../locations/enums/location-type.enum';
import { productSearchHints } from '../products/product-search.hints';
import { assembleStockReport, StockReport, StockReportRow } from './catalog-stock-report';

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
      goldToneOptions: goldToneOptions(),
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
    const { stale: _stale, ...filters } = query;
    return this.products.findMany(filters);
  }

  findById(id: string) {
    return this.products.findById(id);
  }

  search(query: string, limit?: number) {
    return this.products.search(query, limit);
  }

  findLowStock(query: ProductFilterQueryDto) {
    const { stale: _stale, ...filters } = query;
    return this.products.findMany({
      ...filters,
      stockStatus: StockAvailability.LOW,
    });
  }

  findStale(query: ProductFilterQueryDto) {
    return this.products.findMany({
      ...query,
      stale: true,
    });
  }

  async stockReport(query: StockReportQueryDto): Promise<StockReport> {
    const statuses = statusesForScope(query.scope ?? StockReportScope.AVAILABLE);
    const qb = this.itemsRepository
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .innerJoin('product.supplier', 'supplier')
      .select('product.id', 'productId')
      .addSelect('product.sku', 'sku')
      .addSelect('product.name', 'name')
      .addSelect('product.weight', 'weight')
      .addSelect('product.metalCategory', 'metalCategory')
      .addSelect('product.goldTone', 'goldTone')
      .addSelect('product.itemCategory', 'itemCategory')
      .addSelect('product.supplierId', 'supplierId')
      .addSelect('supplier.name', 'supplierName')
      .addSelect('COUNT(item.id)::int', 'units')
      .addSelect('(COUNT(item.id) * product.weight)::float8', 'grams')
      .where('item.deletedAt IS NULL')
      .andWhere('item.status IN (:...statuses)', { statuses })
      .groupBy('product.id')
      .addGroupBy('product.sku')
      .addGroupBy('product.name')
      .addGroupBy('product.weight')
      .addGroupBy('product.metalCategory')
      .addGroupBy('product.goldTone')
      .addGroupBy('product.itemCategory')
      .addGroupBy('product.supplierId')
      .addGroupBy('supplier.name');

    if (query.metalCategory) {
      qb.andWhere('product.metalCategory = :metalCategory', {
        metalCategory: query.metalCategory,
      });
    }
    if (query.itemCategory) {
      qb.andWhere('product.itemCategory = :itemCategory', {
        itemCategory: query.itemCategory,
      });
    }
    if (query.goldTone) {
      qb.andWhere('product.goldTone = :goldTone', { goldTone: query.goldTone });
    }
    if (query.supplierId) {
      qb.andWhere('product.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.locationId) {
      const locationIds = await this.locations.findSubtreeIds(query.locationId);
      if (locationIds.length) {
        qb.andWhere('item.locationId IN (:...locationIds)', { locationIds });
      }
    }
    if (query.q?.trim()) {
      const raw = query.q.trim();
      const q = `%${raw}%`;
      const hints = productSearchHints(raw);
      qb.andWhere(
        `(
          product.sku ILIKE :q
          OR product.name ILIKE :q
          OR supplier.name ILIKE :q
          OR CAST(product.weight AS TEXT) ILIKE :q
          OR CAST(product.metalCategory AS TEXT) ILIKE :q
          OR CAST(product.itemCategory AS TEXT) ILIKE :q
          OR COALESCE(CAST(product.goldTone AS TEXT), '') ILIKE :q
          ${hints.metals.length ? 'OR product.metalCategory IN (:...searchMetals)' : ''}
          ${hints.categories.length ? 'OR product.itemCategory IN (:...searchCategories)' : ''}
          ${hints.tones.length ? 'OR product.goldTone IN (:...searchTones)' : ''}
        )`,
        {
          q,
          ...(hints.metals.length ? { searchMetals: hints.metals } : {}),
          ...(hints.categories.length ? { searchCategories: hints.categories } : {}),
          ...(hints.tones.length ? { searchTones: hints.tones } : {}),
        },
      );
    }

    const raw = await qb.getRawMany<{
      productId: string;
      sku: string;
      name: string;
      weight: string;
      metalCategory: MetalCategory;
      goldTone: GoldTone | null;
      itemCategory: ItemCategory;
      supplierId: string;
      supplierName: string;
      units: string | number;
      grams: string | number;
    }>();

    const rows: StockReportRow[] = raw.map((row) => ({
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      weight: String(row.weight),
      metalCategory: row.metalCategory,
      goldTone: row.goldTone,
      itemCategory: row.itemCategory,
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      units: Number(row.units),
      grams: Number(row.grams),
    }));

    return assembleStockReport(rows, query.productLimit ?? 8);
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

function statusesForScope(scope: StockReportScope): ItemStatus[] {
  if (scope === StockReportScope.IN_STOCK) return [ItemStatus.IN_STOCK];
  if (scope === StockReportScope.ON_DISPLAY) return [ItemStatus.ON_DISPLAY];
  return [ItemStatus.IN_STOCK, ItemStatus.ON_DISPLAY];
}

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Env } from '../config/env.validation';
import { paginated, Paginated, resolvePagination } from '../common/pagination';
import { CATALOG_SEARCH } from '../catalog/search/catalog-search.tokens';
import { CatalogSearchService } from '../catalog/search/catalog-search.service';
import { toProductSearchDocument, isAllowedSortField } from '../catalog/search/catalog-search.ranking';
import {
  CatalogSearchHit,
  CatalogSearchMatch,
} from '../catalog/search/catalog-search.types';
import { Item } from '../inventory/entities/item.entity';
import { AVAILABLE_FOR_SALE } from '../inventory/inventory-stock.calculator';
import { LocationsService } from '../locations/locations.service';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleStatus } from '../sales/enums/sale-status.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductFilterQueryDto } from './dto/product-filter-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Supplier } from './entities/supplier.entity';
import { StockAvailability } from './enums/stock-availability.enum';
import { assertGoldTone } from './product-metal.rules';
import { productSearchHints } from './product-search.hints';
import { formatProductSku } from './product-sku';
import { isStaleDate } from './stale-product.calculator';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductWithStock = Product & {
  availableQty: number;
  stale: boolean;
};

export type ProductSearchResult = ProductWithStock & {
  match: CatalogSearchMatch;
  score: number;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
    @Inject(CATALOG_SEARCH)
    private readonly catalogSearch: CatalogSearchService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<Env, true>,
    private readonly locations: LocationsService,
  ) {}

  async findMany(
    query: ProductFilterQueryDto,
  ): Promise<Paginated<ProductWithStock>> {
    const { page, limit, skip } = resolvePagination(query.page, query.limit);
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.supplier', 'supplier');

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
    if (query.priceMin) {
      qb.andWhere('product.price >= :priceMin', { priceMin: query.priceMin });
    }
    if (query.priceMax) {
      qb.andWhere('product.price <= :priceMax', { priceMax: query.priceMax });
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
          OR COALESCE(CAST(product.price AS TEXT), '') ILIKE :q
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

    const stockLocationIds = query.locationId
      ? await this.locations.findSubtreeIds(query.locationId)
      : null;
    const locationSql = stockLocationIds?.length
      ? ' AND i.location_id IN (:...stockLocationIds)'
      : '';
    const availableSql = `SELECT COUNT(*)::int FROM items i
      WHERE i.product_id = product.id
        AND i.deleted_at IS NULL
        AND i.status IN ('in_stock', 'on_display')${locationSql}`;

    if (stockLocationIds?.length) {
      qb.setParameter('stockLocationIds', stockLocationIds);
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM items loc
          WHERE loc.product_id = product.id
            AND loc.deleted_at IS NULL
            AND loc.location_id IN (:...stockLocationIds)
            AND loc.status IN ('in_stock', 'on_display')
        )`,
        { stockLocationIds },
      );
    }

    const low = this.config.get('LOW_STOCK_THRESHOLD', { infer: true });
    if (query.stockStatus === StockAvailability.IN_STOCK) {
      qb.andWhere(`(${availableSql}) > 0`);
    } else if (query.stockStatus === StockAvailability.OUT_OF_STOCK) {
      qb.andWhere(`(${availableSql}) = 0`);
    } else if (query.stockStatus === StockAvailability.LOW) {
      qb.andWhere(`(${availableSql}) > 0 AND (${availableSql}) <= :low`, {
        low,
      });
    }

    const staleDays = this.config.get('STALE_ITEM_DAYS', { infer: true });
    const staleBefore = new Date(
      Date.now() - staleDays * 24 * 60 * 60 * 1000,
    );
    if (query.stale) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM items stale
          WHERE stale.product_id = product.id
            AND stale.deleted_at IS NULL
            AND stale.status IN ('in_stock', 'on_display')
            AND stale.created_at <= :staleBefore
        )`,
        { staleBefore },
      );
    }

    const sortBy =
      query.sortBy && isAllowedSortField(query.sortBy)
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    if (sortBy === 'availableQty') {
      qb.orderBy(`(${availableSql})`, sortOrder);
    } else if (sortBy === 'supplier') {
      qb.orderBy('supplier.name', sortOrder, 'NULLS LAST');
    } else {
      qb.orderBy(`product.${sortBy}`, sortOrder, 'NULLS LAST');
    }
    qb.skip(skip).take(limit);
    const [products, total] = await qb.getManyAndCount();
    const withStock = await this.attachStock(products, staleDays, stockLocationIds);
    return paginated(withStock, total, page, limit);
  }

  findAll(): Promise<Product[]> {
    return this.productsRepository.find({
      relations: { supplier: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findById(id: string): Promise<ProductWithStock> {
    const product = await this.loadByIdOrSku(id);
    const staleDays = this.config.get('STALE_ITEM_DAYS', { infer: true });
    const [withStock] = await this.attachStock([product], staleDays);
    return withStock;
  }

  async search(query: string, limit?: number): Promise<ProductSearchResult[]> {
    const hits = await this.catalogSearch.search(query, { limit });
    return this.hydrateHits(hits);
  }

  findBySku(sku: string): Promise<Product | null> {
    return this.productsRepository.findOne({
      where: { sku },
      relations: { supplier: true },
    });
  }

  async create(dto: CreateProductDto): Promise<Product> {
    await this.assertSupplier(dto.supplierId);
    const sku = dto.sku?.trim()
      ? dto.sku.trim()
      : await this.nextReadableSku();
    await this.assertUniqueSku(sku);
    const goldTone = assertGoldTone(dto.metalCategory, dto.goldTone ?? null);
    const product = await this.productsRepository.save(
      this.productsRepository.create({
        sku,
        name: dto.name.trim(),
        weight: dto.weight,
        metalCategory: dto.metalCategory,
        goldTone,
        itemCategory: dto.itemCategory,
        supplierId: dto.supplierId,
        price: dto.price ?? null,
        costPrice: dto.costPrice ?? null,
      }),
    );
    const saved = await this.findById(product.id);
    await this.catalogSearch.upsert(toProductSearchDocument(saved));
    return saved;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.loadByIdOrSku(id);
    if (dto.supplierId) {
      await this.assertSupplier(dto.supplierId);
      product.supplierId = dto.supplierId;
    }
    if (dto.sku && dto.sku !== product.sku) {
      await this.assertUniqueSku(dto.sku, product.id);
      product.sku = dto.sku.trim();
    }
    if (dto.name) {
      product.name = dto.name.trim();
    }
    if (dto.weight) {
      product.weight = dto.weight;
    }
    if (dto.itemCategory) {
      product.itemCategory = dto.itemCategory;
    }
    if (dto.price !== undefined) {
      product.price = dto.price ?? null;
    }
    if (dto.costPrice !== undefined) {
      product.costPrice = dto.costPrice ?? null;
    }
    const metal = dto.metalCategory ?? product.metalCategory;
    const tone =
      dto.goldTone !== undefined ? dto.goldTone : product.goldTone;
    product.metalCategory = metal;
    product.goldTone = assertGoldTone(metal, tone);
    await this.productsRepository.save(product);
    const saved = await this.findById(product.id);
    await this.catalogSearch.upsert(toProductSearchDocument(saved));
    return saved;
  }

  async updatePrice(id: string, price: string | null): Promise<Product> {
    return this.update(id, { price });
  }

  async remove(id: string): Promise<void> {
    const product = await this.loadByIdOrSku(id);
    await this.dataSource.transaction(async (manager) => {
      const soldCount = await manager
        .getRepository(SaleItem)
        .createQueryBuilder('line')
        .innerJoin('line.sale', 'sale')
        .where('line.productId = :productId', { productId: product.id })
        .andWhere('sale.status IN (:...statuses)', {
          statuses: [SaleStatus.PAID, SaleStatus.REFUNDED],
        })
        .getCount();
      if (soldCount > 0) {
        throw new ConflictException(
          'Cannot delete a product that has sales',
        );
      }

      const draftLines = await manager
        .getRepository(SaleItem)
        .createQueryBuilder('line')
        .innerJoinAndSelect('line.sale', 'sale')
        .where('line.productId = :productId', { productId: product.id })
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

      await manager.getRepository(Item).delete({ productId: product.id });
      const current = await manager.getRepository(Product).findOneByOrFail({
        id: product.id,
      });
      await manager.getRepository(Product).remove(current);
    });
    await this.catalogSearch.remove(product.id);
  }

  count(): Promise<number> {
    return this.productsRepository.count();
  }

  private async hydrateHits(
    hits: CatalogSearchHit[],
  ): Promise<ProductSearchResult[]> {
    if (hits.length === 0) {
      return [];
    }
    const products = await this.productsRepository.find({
      where: { id: In(hits.map((hit) => hit.productId)) },
      relations: { supplier: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const orderedHits = hits.filter((hit) => byId.has(hit.productId));
    const ordered = orderedHits.map((hit) => byId.get(hit.productId) as Product);
    const staleDays = this.config.get('STALE_ITEM_DAYS', { infer: true });
    const withStock = await this.attachStock(ordered, staleDays);
    return withStock.map((product, index) =>
      Object.assign(product, {
        match: orderedHits[index].match,
        score: orderedHits[index].score,
      }),
    );
  }

  private async loadByIdOrSku(idOrSku: string): Promise<Product> {
    const key = idOrSku.trim();
    const product = await this.productsRepository.findOne({
      where: UUID_RE.test(key) ? { id: key } : { sku: key },
      relations: { supplier: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async nextReadableSku(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rows = (await this.dataSource.query(
        `SELECT nextval('product_sku_seq') AS n`,
      )) as Array<{ n: string | number }>;
      const sku = formatProductSku(Number(rows[0].n));
      const taken = await this.productsRepository.findOne({ where: { sku } });
      if (!taken) {
        return sku;
      }
    }
    throw new ConflictException('Could not allocate a product article');
  }

  private async assertSupplier(supplierId: string): Promise<void> {
    const supplier = await this.suppliersRepository.findOne({
      where: { id: supplierId, isActive: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
  }

  private async assertUniqueSku(sku: string, exceptId?: string): Promise<void> {
    const existing = await this.productsRepository.findOne({
      where: { sku: sku.trim() },
    });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('SKU already exists');
    }
  }

  private async attachStock(
    products: Product[],
    staleDays: number,
    locationIds?: string[] | null,
  ): Promise<ProductWithStock[]> {
    if (products.length === 0) {
      return [];
    }
    const ids = products.map((product) => product.id);
    const qb = this.itemsRepository
      .createQueryBuilder('item')
      .select('item.productId', 'productId')
      .addSelect(
        `SUM(CASE WHEN item.status IN ('in_stock','on_display') THEN 1 ELSE 0 END)`,
        'availableQty',
      )
      .addSelect('MIN(item.createdAt)', 'oldestAvailable')
      .where('item.productId IN (:...ids)', { ids })
      .andWhere('item.deletedAt IS NULL')
      .andWhere('item.status IN (:...statuses)', {
        statuses: [...AVAILABLE_FOR_SALE],
      });
    if (locationIds?.length) {
      qb.andWhere('item.locationId IN (:...locationIds)', { locationIds });
    }
    const rows = await qb.groupBy('item.productId').getRawMany<{
      productId: string;
      availableQty: string;
      oldestAvailable: Date;
    }>();

    const byProduct = new Map(
      rows.map((row) => [
        row.productId,
        {
          availableQty: Number(row.availableQty),
          stale: row.oldestAvailable
            ? isStaleDate(new Date(row.oldestAvailable), staleDays)
            : false,
        },
      ]),
    );

    return products.map((product) => {
      const stock = byProduct.get(product.id);
      return Object.assign(product, {
        availableQty: stock?.availableQty ?? 0,
        stale: stock?.stale ?? false,
      });
    });
  }
}

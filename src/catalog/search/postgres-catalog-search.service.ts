import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { CatalogSearchService } from './catalog-search.service';
import {
  escapeIlike,
  mergeSearchHits,
  resolveSearchLimit,
  sanitizeSearchQuery,
} from './catalog-search.ranking';
import {
  CatalogSearchHit,
  CatalogSearchMatch,
  CatalogSearchOptions,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  ProductSearchDocument,
} from './catalog-search.types';

const SEARCH_CACHE_TTL_SECONDS = 20;
const SEARCH_CACHE_GEN_KEY = 'catalog:search:generation';

interface SearchRow {
  productId: string;
  match: CatalogSearchMatch;
  score: string | number;
}

@Injectable()
export class PostgresCatalogSearchService implements CatalogSearchService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cache: RedisCacheService,
  ) {}

  async search(
    query: string,
    options?: CatalogSearchOptions,
  ): Promise<CatalogSearchHit[]> {
    const normalized = sanitizeSearchQuery(query);
    if (!normalized) {
      return [];
    }
    const limit = resolveSearchLimit(
      options?.limit,
      DEFAULT_SEARCH_LIMIT,
      MAX_SEARCH_LIMIT,
    );
    const cacheKey = await this.cacheKey(normalized, limit);
    const cached = await this.cache.get<CatalogSearchHit[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const like = `%${escapeIlike(normalized)}%`;
    const [skuRows, nameRows, supplierRows] = await Promise.all([
      this.dataSource.query<SearchRow[]>(
        `
        SELECT product.id AS "productId", 'sku'::text AS match, 1::float AS score
        FROM products product
        WHERE product.sku = $1 OR lower(product.sku) = lower($1)
        LIMIT 5
        `,
        [normalized],
      ),
      this.dataSource.query<SearchRow[]>(
        `
        SELECT product.id AS "productId",
               'name'::text AS match,
               GREATEST(
                 COALESCE(ts_rank(product.name_tsv, plainto_tsquery('simple', $1)), 0),
                 similarity(product.name, $1)
               ) AS score
        FROM products product
        WHERE product.name_tsv @@ plainto_tsquery('simple', $1)
           OR product.name ILIKE $2 ESCAPE '\\'
        ORDER BY score DESC
        LIMIT $3
        `,
        [normalized, like, limit],
      ),
      this.dataSource.query<SearchRow[]>(
        `
        SELECT product.id AS "productId",
               'supplier'::text AS match,
               similarity(supplier.name, $1) AS score
        FROM products product
        INNER JOIN suppliers supplier ON supplier.id = product.supplier_id
        WHERE supplier.name ILIKE $2 ESCAPE '\\'
        ORDER BY score DESC
        LIMIT $3
        `,
        [normalized, like, limit],
      ),
    ]);

    const hits = mergeSearchHits([
      this.toHits(skuRows),
      this.toHits(nameRows),
      this.toHits(supplierRows),
    ]).slice(0, limit);

    await this.cache.set(cacheKey, hits, SEARCH_CACHE_TTL_SECONDS);
    return hits;
  }

  async upsert(_document: ProductSearchDocument): Promise<void> {
    await this.bumpCache();
  }

  async remove(_productId: string): Promise<void> {
    await this.bumpCache();
  }

  private toHits(rows: SearchRow[]): CatalogSearchHit[] {
    return rows.map((row) => ({
      productId: row.productId,
      match: row.match,
      score: Number(row.score) || 0,
    }));
  }

  private async cacheKey(query: string, limit: number): Promise<string> {
    const generation = await this.cache.getRaw(SEARCH_CACHE_GEN_KEY);
    return `catalog:search:${generation ?? '0'}:${query.toLowerCase()}:${limit}`;
  }

  private async bumpCache(): Promise<void> {
    await this.cache.incr(SEARCH_CACHE_GEN_KEY);
  }
}

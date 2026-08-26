import type { ProductSearchDocument } from './catalog-search.types';
import type {
  CatalogSearchHit,
  CatalogSearchOptions,
} from './catalog-search.types';

/**
 * Swappable catalog search. Controllers depend on this token only.
 * Postgres implementation uses unique SKU + GIN tsvector/pg_trgm.
 * Elasticsearch implementation indexes the same ProductSearchDocument.
 */
export interface CatalogSearchService {
  search(
    query: string,
    options?: CatalogSearchOptions,
  ): Promise<CatalogSearchHit[]>;

  upsert(document: ProductSearchDocument): Promise<void>;

  remove(productId: string): Promise<void>;
}

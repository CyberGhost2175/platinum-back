export type CatalogSearchMatch = 'sku' | 'name' | 'supplier';

export interface CatalogSearchHit {
  productId: string;
  match: CatalogSearchMatch;
  score: number;
}

export interface CatalogSearchOptions {
  limit?: number;
}

export interface ProductSearchDocument {
  id: string;
  sku: string;
  name: string;
  supplierId: string;
  supplierName: string | null;
}

export const SEARCH_MATCH_PRIORITY: Record<CatalogSearchMatch, number> = {
  sku: 0,
  name: 1,
  supplier: 2,
};

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;

import {
  CatalogSearchHit,
  CatalogSearchMatch,
  SEARCH_MATCH_PRIORITY,
} from './catalog-search.types';

export function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

export function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[&|!():*<>']/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveSearchLimit(limit?: number, fallback = 20, max = 50): number {
  if (limit === undefined) {
    return fallback;
  }
  return Math.min(max, Math.max(1, limit));
}

export function betterHit(
  current: CatalogSearchHit | undefined,
  next: CatalogSearchHit,
): CatalogSearchHit {
  if (!current) {
    return next;
  }
  const currentPriority = SEARCH_MATCH_PRIORITY[current.match];
  const nextPriority = SEARCH_MATCH_PRIORITY[next.match];
  if (nextPriority < currentPriority) {
    return next;
  }
  if (nextPriority === currentPriority && next.score > current.score) {
    return next;
  }
  return current;
}

export function mergeSearchHits(
  groups: ReadonlyArray<ReadonlyArray<CatalogSearchHit>>,
): CatalogSearchHit[] {
  const byId = new Map<string, CatalogSearchHit>();
  for (const group of groups) {
    for (const hit of group) {
      byId.set(hit.productId, betterHit(byId.get(hit.productId), hit));
    }
  }
  return [...byId.values()].sort((a, b) => {
    const byMatch =
      SEARCH_MATCH_PRIORITY[a.match] - SEARCH_MATCH_PRIORITY[b.match];
    if (byMatch !== 0) {
      return byMatch;
    }
    return b.score - a.score;
  });
}

export function toProductSearchDocument(product: {
  id: string;
  sku: string;
  name: string;
  supplierId: string;
  supplier?: { name?: string } | null;
}): {
  id: string;
  sku: string;
  name: string;
  supplierId: string;
  supplierName: string | null;
} {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    supplierId: product.supplierId,
    supplierName: product.supplier?.name ?? null,
  };
}

export function promotionReason(
  availableQty: number,
  stale: boolean,
  lowThreshold: number,
): 'low' | 'stale' | 'low_and_stale' | null {
  const low = availableQty > 0 && availableQty <= lowThreshold;
  if (low && stale) {
    return 'low_and_stale';
  }
  if (low) {
    return 'low';
  }
  if (stale) {
    return 'stale';
  }
  return null;
}

export function isAllowedSortField(
  value: string,
): value is
  | 'name'
  | 'price'
  | 'createdAt'
  | 'sku'
  | 'availableQty'
  | 'weight'
  | 'supplier' {
  return (
    value === 'name' ||
    value === 'price' ||
    value === 'createdAt' ||
    value === 'sku' ||
    value === 'availableQty' ||
    value === 'weight' ||
    value === 'supplier'
  );
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pageCount: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function resolvePagination(page?: number, limit?: number) {
  const resolvedPage = Math.max(1, page ?? DEFAULT_PAGE);
  const resolvedLimit = Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT));
  return {
    page: resolvedPage,
    limit: resolvedLimit,
    skip: (resolvedPage - 1) * resolvedLimit,
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      pageCount: Math.ceil(total / limit) || 0,
    },
  };
}

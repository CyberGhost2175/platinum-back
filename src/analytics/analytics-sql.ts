import { AnalyticsGroupBy } from './enums/analytics.enums';

const GROUP_BY_COLUMNS: Record<AnalyticsGroupBy, string> = {
  [AnalyticsGroupBy.ITEM_CATEGORY]: 'mv.item_category',
  [AnalyticsGroupBy.METAL_CATEGORY]: 'mv.metal_category',
  [AnalyticsGroupBy.PRICE_SEGMENT]: 'mv.price_segment',
};

export function groupByColumnSql(groupBy: AnalyticsGroupBy): string {
  const column = GROUP_BY_COLUMNS[groupBy];
  if (!column) {
    throw new Error('Invalid analytics groupBy');
  }
  return column;
}

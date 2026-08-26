import { AnalyticsGroupBy } from './enums/analytics.enums';
import { groupByColumnSql } from './analytics-sql';

describe('groupByColumnSql', () => {
  it('maps enum values to fixed identifiers', () => {
    expect(groupByColumnSql(AnalyticsGroupBy.ITEM_CATEGORY)).toBe(
      'mv.item_category',
    );
    expect(groupByColumnSql(AnalyticsGroupBy.METAL_CATEGORY)).toBe(
      'mv.metal_category',
    );
    expect(groupByColumnSql(AnalyticsGroupBy.PRICE_SEGMENT)).toBe(
      'mv.price_segment',
    );
  });

  it('rejects unknown groupBy', () => {
    expect(() => groupByColumnSql('injection' as AnalyticsGroupBy)).toThrow(
      'Invalid analytics groupBy',
    );
  });
});

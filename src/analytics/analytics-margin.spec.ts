import {
  costFromRubles,
  marginPercent,
  priceSegmentOf,
} from './analytics-margin';
import { PriceSegment } from './enums/analytics.enums';

describe('analytics margin and price segments', () => {
  it('maps unit prices to budget / mid / premium', () => {
    expect(priceSegmentOf(1_999_999)).toBe(PriceSegment.BUDGET);
    expect(priceSegmentOf(2_000_000)).toBe(PriceSegment.MID);
    expect(priceSegmentOf(8_000_000)).toBe(PriceSegment.PREMIUM);
  });

  it('computes margin percent from kopecks', () => {
    expect(marginPercent(100000, 40000)).toBe(60);
    expect(marginPercent(0, 0)).toBeNull();
  });

  it('converts nullable ruble cost to kopecks times qty', () => {
    expect(costFromRubles('22100.00', 2)).toBe(4_420_000);
    expect(costFromRubles(null, 1)).toBeNull();
  });
});

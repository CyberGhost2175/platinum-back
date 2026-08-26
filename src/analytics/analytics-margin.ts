import { PriceSegment } from './enums/analytics.enums';

/** Thresholds in kopecks (20 000 ₽ and 80 000 ₽). */
export const BUDGET_MAX_MINOR = 2_000_000;
export const MID_MAX_MINOR = 8_000_000;

export function priceSegmentOf(unitPriceMinor: number): PriceSegment {
  if (unitPriceMinor < BUDGET_MAX_MINOR) {
    return PriceSegment.BUDGET;
  }
  if (unitPriceMinor < MID_MAX_MINOR) {
    return PriceSegment.MID;
  }
  return PriceSegment.PREMIUM;
}

export function marginMinor(revenueMinor: number, costMinor: number): number {
  return revenueMinor - costMinor;
}

export function marginPercent(revenueMinor: number, costMinor: number): number | null {
  if (revenueMinor <= 0) {
    return null;
  }
  return Math.round(((revenueMinor - costMinor) / revenueMinor) * 10000) / 100;
}

export function costFromRubles(costPrice: string | null | undefined, qty: number): number | null {
  if (costPrice === null || costPrice === undefined) {
    return null;
  }
  const rubles = Number(costPrice);
  if (!Number.isFinite(rubles) || rubles < 0) {
    return null;
  }
  return Math.round(rubles * 100) * qty;
}

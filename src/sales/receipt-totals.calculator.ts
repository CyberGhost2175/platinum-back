export interface LinePricingInput {
  qty: number;
  unitPriceMinor: number;
  discountMinor?: number;
  discountPercent?: number;
}

export interface LinePricing {
  gross: number;
  discount: number;
  total: number;
}

export interface ReceiptPricingInput {
  lines: LinePricing[];
  discountMinor?: number;
  discountPercent?: number;
}

export const KNOWN_PROMOS: Record<
  string,
  { percent?: number; amountMinor?: number }
> = {
  SALE10: { percent: 10 },
  VIP500: { amountMinor: 50_000 },
};

export function resolvePromo(code?: string | null): {
  percent?: number;
  amountMinor?: number;
} | null {
  if (!code?.trim()) {
    return null;
  }
  return KNOWN_PROMOS[code.trim().toUpperCase()] ?? null;
}

export function toKopecks(rubles: string | number): number {
  const value = typeof rubles === 'number' ? rubles : Number(rubles);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Invalid price');
  }
  return Math.round(value * 100);
}

export function calcLinePricing(input: LinePricingInput): LinePricing {
  if (!Number.isInteger(input.qty) || input.qty < 1) {
    throw new Error('Quantity must be a positive integer');
  }
  if (!Number.isInteger(input.unitPriceMinor) || input.unitPriceMinor < 0) {
    throw new Error('Unit price must be a non-negative integer in kopecks');
  }
  const discountMinor = input.discountMinor ?? 0;
  const discountPercent = input.discountPercent ?? 0;
  if (discountMinor < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid line discount');
  }
  const gross = input.qty * input.unitPriceMinor;
  const percentOff = Math.round((gross * discountPercent) / 100);
  const discount = discountMinor + percentOff;
  if (discount > gross) {
    throw new Error('Line discount exceeds line amount');
  }
  return { gross, discount, total: gross - discount };
}

export function calcReceiptPricing(input: ReceiptPricingInput): {
  subtotal: number;
  discount: number;
  total: number;
} {
  const subtotal = input.lines.reduce((sum, line) => sum + line.total, 0);
  const discountMinor = input.discountMinor ?? 0;
  const discountPercent = input.discountPercent ?? 0;
  if (discountMinor < 0 || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid receipt discount');
  }
  const percentOff = Math.round((subtotal * discountPercent) / 100);
  const discount = discountMinor + percentOff;
  if (discount > subtotal) {
    throw new Error('Receipt discount exceeds subtotal');
  }
  return { subtotal, discount, total: subtotal - discount };
}

export function mergePromoDiscount(
  promo: { percent?: number; amountMinor?: number } | null,
  discountMinor?: number,
  discountPercent?: number,
): { discountMinor: number; discountPercent: number } {
  return {
    discountMinor: discountMinor ?? promo?.amountMinor ?? 0,
    discountPercent: discountPercent ?? promo?.percent ?? 0,
  };
}

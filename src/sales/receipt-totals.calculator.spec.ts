import {
  calcLinePricing,
  calcReceiptPricing,
  mergePromoDiscount,
  resolvePromo,
  toKopecks,
} from './receipt-totals.calculator';

describe('receipt-totals.calculator', () => {
  it('converts rubles to kopecks', () => {
    expect(toKopecks('1500.50')).toBe(150050);
    expect(toKopecks(10)).toBe(1000);
  });

  it('applies line-level amount and percent discounts', () => {
    expect(
      calcLinePricing({
        qty: 1,
        unitPriceMinor: 100000,
        discountMinor: 5000,
        discountPercent: 10,
      }),
    ).toEqual({ gross: 100000, discount: 15000, total: 85000 });
  });

  it('applies receipt-level promo SALE10', () => {
    const promo = resolvePromo('sale10');
    const merged = mergePromoDiscount(promo);
    const line = calcLinePricing({ qty: 1, unitPriceMinor: 200000 });
    const receipt = calcReceiptPricing({
      lines: [line],
      discountPercent: merged.discountPercent,
      discountMinor: merged.discountMinor,
    });
    expect(receipt).toEqual({
      subtotal: 200000,
      discount: 20000,
      total: 180000,
    });
  });

  it('applies receipt-level promo VIP500 as a fixed amount', () => {
    const promo = resolvePromo('VIP500');
    const line = calcLinePricing({ qty: 1, unitPriceMinor: 100000 });
    const receipt = calcReceiptPricing({
      lines: [line],
      ...mergePromoDiscount(promo),
    });
    expect(receipt.discount).toBe(50000);
    expect(receipt.total).toBe(50000);
  });

  it('rejects a discount greater than the line amount', () => {
    expect(() =>
      calcLinePricing({
        qty: 1,
        unitPriceMinor: 100,
        discountMinor: 101,
      }),
    ).toThrow('Line discount exceeds line amount');
  });
});

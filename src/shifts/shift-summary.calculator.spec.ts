import { buildShiftSummary } from './shift-summary.calculator';

describe('shift-summary.calculator', () => {
  it('builds a close-shift summary with cash/card totals and average check', () => {
    const summary = buildShiftSummary(150000, 50000, [
      { totalAmountMinor: 150000, itemsQty: 1 },
      { totalAmountMinor: 50000, itemsQty: 2 },
    ]);

    expect(summary).toEqual({
      cashTotal: 150000,
      cardTotal: 50000,
      grandTotal: 200000,
      receiptsCount: 2,
      averageCheck: 100000,
      soldItemsCount: 3,
    });
  });

  it('returns a zero average when the shift has no paid receipts', () => {
    expect(buildShiftSummary(0, 0, [])).toEqual({
      cashTotal: 0,
      cardTotal: 0,
      grandTotal: 0,
      receiptsCount: 0,
      averageCheck: 0,
      soldItemsCount: 0,
    });
  });
});

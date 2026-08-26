export interface PaidSaleSnapshot {
  totalAmountMinor: number;
  itemsQty: number;
}

export interface ShiftSummary {
  cashTotal: number;
  cardTotal: number;
  grandTotal: number;
  receiptsCount: number;
  averageCheck: number;
  soldItemsCount: number;
}

export function buildShiftSummary(
  cashTotal: number,
  cardTotal: number,
  receipts: ReadonlyArray<PaidSaleSnapshot>,
): ShiftSummary {
  const receiptsCount = receipts.length;
  const grandTotal = cashTotal + cardTotal;
  const soldItemsCount = receipts.reduce((sum, row) => sum + row.itemsQty, 0);
  const averageCheck =
    receiptsCount === 0 ? 0 : Math.round(grandTotal / receiptsCount);
  return {
    cashTotal,
    cardTotal,
    grandTotal,
    receiptsCount,
    averageCheck,
    soldItemsCount,
  };
}

import { PaymentMethod } from '../sales/enums/payment-method.enum';

export interface ShiftTotals {
  cashTotal: number;
  cardTotal: number;
}

const ZERO_TOTALS: ShiftTotals = { cashTotal: 0, cardTotal: 0 };

export function emptyShiftTotals(): ShiftTotals {
  return { ...ZERO_TOTALS };
}

/** Amounts are integer minor units (kopecks) to avoid float drift. */
export function applySaleToShift(
  totals: ShiftTotals,
  amountMinor: number,
  method: PaymentMethod,
): ShiftTotals {
  assertPositiveAmount(amountMinor);
  if (method === PaymentMethod.CASH) {
    return { ...totals, cashTotal: totals.cashTotal + amountMinor };
  }
  return { ...totals, cardTotal: totals.cardTotal + amountMinor };
}

export function applyRefundToShift(
  totals: ShiftTotals,
  amountMinor: number,
  method: PaymentMethod,
): ShiftTotals {
  assertPositiveAmount(amountMinor);
  const next: ShiftTotals =
    method === PaymentMethod.CASH
      ? { ...totals, cashTotal: totals.cashTotal - amountMinor }
      : { ...totals, cardTotal: totals.cardTotal - amountMinor };

  if (next.cashTotal < 0 || next.cardTotal < 0) {
    throw new Error('Refund exceeds shift totals');
  }
  return next;
}

export function getShiftGrandTotal(totals: ShiftTotals): number {
  return totals.cashTotal + totals.cardTotal;
}

function assertPositiveAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Amount must be a positive integer in minor units');
  }
}

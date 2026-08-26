import { PaymentMethod } from '../sales/enums/payment-method.enum';
import {
  applyRefundToShift,
  applySaleToShift,
  emptyShiftTotals,
  getShiftGrandTotal,
} from './shift-totals.calculator';

describe('shift-totals.calculator', () => {
  it('starts a shift with zero cash and card totals', () => {
    expect(emptyShiftTotals()).toEqual({ cashTotal: 0, cardTotal: 0 });
  });

  it('accumulates cash and card sales independently', () => {
    let totals = emptyShiftTotals();
    totals = applySaleToShift(totals, 150000, PaymentMethod.CASH);
    totals = applySaleToShift(totals, 9900, PaymentMethod.CARD);
    totals = applySaleToShift(totals, 100, PaymentMethod.CASH);

    expect(totals).toEqual({ cashTotal: 150100, cardTotal: 9900 });
    expect(getShiftGrandTotal(totals)).toBe(160000);
  });

  it('applies a refund against the matching payment method', () => {
    let totals = applySaleToShift(
      emptyShiftTotals(),
      50000,
      PaymentMethod.CARD,
    );
    totals = applyRefundToShift(totals, 20000, PaymentMethod.CARD);

    expect(totals).toEqual({ cashTotal: 0, cardTotal: 30000 });
  });

  it('rejects non-positive or non-integer amounts', () => {
    expect(() =>
      applySaleToShift(emptyShiftTotals(), 0, PaymentMethod.CASH),
    ).toThrow('Amount must be a positive integer in minor units');
    expect(() =>
      applySaleToShift(emptyShiftTotals(), 10.5, PaymentMethod.CASH),
    ).toThrow('Amount must be a positive integer in minor units');
  });

  it('rejects a refund that would drive a total negative', () => {
    const totals = applySaleToShift(
      emptyShiftTotals(),
      1000,
      PaymentMethod.CASH,
    );
    expect(() =>
      applyRefundToShift(totals, 1001, PaymentMethod.CASH),
    ).toThrow('Refund exceeds shift totals');
  });
});

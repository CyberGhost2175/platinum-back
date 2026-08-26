import { ItemStatus } from '../inventory/enums/item-status.enum';
import {
  assertCanSellItem,
  canAddItemToDraft,
  isOutOfStockAfterSale,
  remainingAvailableAfterSale,
  restoreSoldItem,
  sellItem,
} from './sale-stock.calculator';

describe('sale-stock.calculator', () => {
  it('allows adding an item when stock is available', () => {
    expect(canAddItemToDraft(1, false)).toBe(true);
    expect(() =>
      assertCanSellItem(ItemStatus.IN_STOCK, false),
    ).not.toThrow();
    expect(sellItem(ItemStatus.ON_DISPLAY)).toBe(ItemStatus.SOLD);
  });

  it('rejects a sale when remaining stock is zero or the product is marked out of stock', () => {
    expect(canAddItemToDraft(0, false)).toBe(false);
    expect(canAddItemToDraft(2, true)).toBe(false);
    expect(() =>
      assertCanSellItem(ItemStatus.IN_STOCK, true),
    ).toThrow('Product is out of stock');
    expect(() =>
      assertCanSellItem(ItemStatus.SOLD, false),
    ).toThrow('Item is not available for sale');
  });

  it('marks the product out of stock after the last unit is sold', () => {
    const remaining = remainingAvailableAfterSale(1, 1);
    expect(remaining).toBe(0);
    expect(isOutOfStockAfterSale(remaining)).toBe(true);
    expect(isOutOfStockAfterSale(remainingAvailableAfterSale(2, 1))).toBe(
      false,
    );
  });

  it('restores a sold item back to stock on refund', () => {
    expect(restoreSoldItem(ItemStatus.SOLD)).toBe(ItemStatus.IN_STOCK);
    expect(() => restoreSoldItem(ItemStatus.IN_STOCK)).toThrow(
      'Only sold items can be returned to stock',
    );
  });
});

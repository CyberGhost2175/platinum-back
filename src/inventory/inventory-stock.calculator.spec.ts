import { ItemStatus } from './enums/item-status.enum';
import {
  applyReturnToStock,
  applySale,
  applyStatusChange,
  countAvailableStock,
  putOnDisplay,
  recountStockByProduct,
  returnFromCleaning,
  returnFromCommission,
  returnFromRepair,
  sendToCleaning,
  sendToCommission,
  sendToRepair,
} from './inventory-stock.calculator';

describe('inventory-stock.calculator', () => {
  const items = [
    { productId: 'ring', status: ItemStatus.IN_STOCK },
    { productId: 'ring', status: ItemStatus.ON_DISPLAY },
    { productId: 'ring', status: ItemStatus.SOLD },
    { productId: 'earring', status: ItemStatus.IN_REPAIR },
    { productId: 'earring', status: ItemStatus.IN_STOCK },
  ];

  it('counts only in-stock and on-display units as available', () => {
    expect(countAvailableStock(items)).toBe(3);
  });

  it('recounts remaining stock per product SKU-instance group', () => {
    expect(recountStockByProduct(items)).toEqual({
      ring: 2,
      earring: 1,
    });
  });

  it('moves an available item to sold on sale', () => {
    expect(applySale(ItemStatus.IN_STOCK)).toBe(ItemStatus.SOLD);
    expect(applySale(ItemStatus.ON_DISPLAY)).toBe(ItemStatus.SOLD);
  });

  it('rejects sale of unavailable items', () => {
    expect(() => applySale(ItemStatus.SOLD)).toThrow(
      'Item is not available for sale',
    );
    expect(() => applySale(ItemStatus.IN_REPAIR)).toThrow(
      'Item is not available for sale',
    );
  });

  it('returns a sold item back to stock', () => {
    expect(applyReturnToStock(ItemStatus.SOLD)).toBe(ItemStatus.IN_STOCK);
    expect(() => applyReturnToStock(ItemStatus.IN_STOCK)).toThrow(
      'Only sold items can be returned to stock',
    );
  });

  it('sends available items to repair and back', () => {
    expect(sendToRepair(ItemStatus.IN_STOCK)).toBe(ItemStatus.IN_REPAIR);
    expect(returnFromRepair(ItemStatus.IN_REPAIR)).toBe(ItemStatus.IN_STOCK);
    expect(() => returnFromRepair(ItemStatus.IN_STOCK)).toThrow(
      'Item is not in repair',
    );
  });

  it('puts in-stock items on display', () => {
    expect(putOnDisplay(ItemStatus.IN_STOCK)).toBe(ItemStatus.ON_DISPLAY);
    expect(() => putOnDisplay(ItemStatus.SOLD)).toThrow(
      'Only in-stock items can be put on display',
    );
  });

  it('sends available items to cleaning and commission', () => {
    expect(sendToCleaning(ItemStatus.IN_STOCK)).toBe(ItemStatus.IN_CLEANING);
    expect(returnFromCleaning(ItemStatus.IN_CLEANING)).toBe(ItemStatus.IN_STOCK);
    expect(sendToCommission(ItemStatus.ON_DISPLAY)).toBe(
      ItemStatus.ON_COMMISSION,
    );
    expect(returnFromCommission(ItemStatus.ON_COMMISSION)).toBe(
      ItemStatus.IN_STOCK,
    );
  });

  it('applies allowed status changes and rejects sale via this flow', () => {
    expect(applyStatusChange(ItemStatus.IN_STOCK, ItemStatus.IN_REPAIR)).toBe(
      ItemStatus.IN_REPAIR,
    );
    expect(() =>
      applyStatusChange(ItemStatus.IN_STOCK, ItemStatus.SOLD),
    ).toThrow('Use sales flow to mark an item as sold');
  });
});

import { ItemStatus } from '../inventory/enums/item-status.enum';
import { AVAILABLE_FOR_SALE } from '../inventory/inventory-stock.calculator';
import { applySale, applyReturnToStock } from '../inventory/inventory-stock.calculator';

export function canAddItemToDraft(
  availableQty: number,
  productOutOfStock: boolean,
): boolean {
  return !productOutOfStock && availableQty > 0;
}

export function assertCanSellItem(
  status: ItemStatus,
  productOutOfStock: boolean,
): void {
  if (productOutOfStock) {
    throw new Error('Product is out of stock');
  }
  if (!AVAILABLE_FOR_SALE.has(status)) {
    throw new Error('Item is not available for sale');
  }
}

export function remainingAvailableAfterSale(
  availableBefore: number,
  soldQty: number,
): number {
  return Math.max(0, availableBefore - soldQty);
}

export function isOutOfStockAfterSale(remainingAvailable: number): boolean {
  return remainingAvailable <= 0;
}

export function sellItem(status: ItemStatus): ItemStatus {
  return applySale(status);
}

export function restoreSoldItem(status: ItemStatus): ItemStatus {
  return applyReturnToStock(status);
}

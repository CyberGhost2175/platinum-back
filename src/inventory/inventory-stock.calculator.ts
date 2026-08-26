import { ItemStatus } from './enums/item-status.enum';

export const AVAILABLE_FOR_SALE: ReadonlySet<ItemStatus> = new Set([
  ItemStatus.IN_STOCK,
  ItemStatus.ON_DISPLAY,
]);

/** Физически ожидаются на локации при инвентаризации. */
export const PHYSICAL_ON_SITE: ReadonlySet<ItemStatus> = new Set([
  ItemStatus.IN_STOCK,
  ItemStatus.ON_DISPLAY,
  ItemStatus.IN_CLEANING,
  ItemStatus.ON_COMMISSION,
]);

export function countAvailableStock(
  items: ReadonlyArray<{ status: ItemStatus }>,
): number {
  return items.filter((item) => AVAILABLE_FOR_SALE.has(item.status)).length;
}

export function recountStockByProduct(
  items: ReadonlyArray<{ productId: string; status: ItemStatus }>,
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    if (AVAILABLE_FOR_SALE.has(item.status)) {
      acc[item.productId] = (acc[item.productId] ?? 0) + 1;
    } else if (acc[item.productId] === undefined) {
      acc[item.productId] = 0;
    }
    return acc;
  }, {});
}

export function applySale(status: ItemStatus): ItemStatus {
  if (!AVAILABLE_FOR_SALE.has(status)) {
    throw new Error('Item is not available for sale');
  }
  return ItemStatus.SOLD;
}

export function applyReturnToStock(status: ItemStatus): ItemStatus {
  if (status !== ItemStatus.SOLD) {
    throw new Error('Only sold items can be returned to stock');
  }
  return ItemStatus.IN_STOCK;
}

export function sendToRepair(status: ItemStatus): ItemStatus {
  if (!AVAILABLE_FOR_SALE.has(status)) {
    throw new Error('Item cannot be sent to repair');
  }
  return ItemStatus.IN_REPAIR;
}

export function returnFromRepair(status: ItemStatus): ItemStatus {
  if (status !== ItemStatus.IN_REPAIR) {
    throw new Error('Item is not in repair');
  }
  return ItemStatus.IN_STOCK;
}

export function sendToCleaning(status: ItemStatus): ItemStatus {
  if (!AVAILABLE_FOR_SALE.has(status)) {
    throw new Error('Item cannot be sent to cleaning');
  }
  return ItemStatus.IN_CLEANING;
}

export function returnFromCleaning(status: ItemStatus): ItemStatus {
  if (status !== ItemStatus.IN_CLEANING) {
    throw new Error('Item is not in cleaning');
  }
  return ItemStatus.IN_STOCK;
}

export function sendToCommission(status: ItemStatus): ItemStatus {
  if (!AVAILABLE_FOR_SALE.has(status)) {
    throw new Error('Item cannot be sent to commission');
  }
  return ItemStatus.ON_COMMISSION;
}

export function returnFromCommission(status: ItemStatus): ItemStatus {
  if (status !== ItemStatus.ON_COMMISSION) {
    throw new Error('Item is not on commission');
  }
  return ItemStatus.IN_STOCK;
}

export function putOnDisplay(status: ItemStatus): ItemStatus {
  if (status !== ItemStatus.IN_STOCK) {
    throw new Error('Only in-stock items can be put on display');
  }
  return ItemStatus.ON_DISPLAY;
}

export function takeOffDisplay(status: ItemStatus): ItemStatus {
  if (status !== ItemStatus.ON_DISPLAY) {
    throw new Error('Only on-display items can be returned to stock');
  }
  return ItemStatus.IN_STOCK;
}

export function applyStatusChange(
  from: ItemStatus,
  to: ItemStatus,
): ItemStatus {
  if (from === to) {
    return from;
  }
  switch (to) {
    case ItemStatus.IN_REPAIR:
      return sendToRepair(from);
    case ItemStatus.IN_CLEANING:
      return sendToCleaning(from);
    case ItemStatus.ON_COMMISSION:
      return sendToCommission(from);
    case ItemStatus.ON_DISPLAY:
      return putOnDisplay(from);
    case ItemStatus.IN_STOCK:
      if (from === ItemStatus.IN_REPAIR) {
        return returnFromRepair(from);
      }
      if (from === ItemStatus.IN_CLEANING) {
        return returnFromCleaning(from);
      }
      if (from === ItemStatus.ON_COMMISSION) {
        return returnFromCommission(from);
      }
      if (from === ItemStatus.ON_DISPLAY) {
        return takeOffDisplay(from);
      }
      if (from === ItemStatus.SOLD) {
        return applyReturnToStock(from);
      }
      throw new Error(`Cannot change status from ${from} to ${to}`);
    case ItemStatus.SOLD:
      throw new Error('Use sales flow to mark an item as sold');
    default:
      throw new Error(`Cannot change status from ${from} to ${to}`);
  }
}

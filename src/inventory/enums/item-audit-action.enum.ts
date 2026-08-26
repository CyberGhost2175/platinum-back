import { ItemStatus } from './item-status.enum';

export enum ItemAuditAction {
  CREATED = 'created',
  STATUS_CHANGED = 'status_changed',
  MOVED = 'moved',
  SOLD = 'sold',
  RETURNED = 'returned',
  SENT_TO_REPAIR = 'sent_to_repair',
  RETURNED_FROM_REPAIR = 'returned_from_repair',
  SENT_TO_CLEANING = 'sent_to_cleaning',
  RETURNED_FROM_CLEANING = 'returned_from_cleaning',
  SENT_TO_COMMISSION = 'sent_to_commission',
  RETURNED_FROM_COMMISSION = 'returned_from_commission',
  SOFT_DELETED = 'soft_deleted',
  RESTORED = 'restored',
}

export function auditActionForStatusChange(
  from: ItemStatus,
  to: ItemStatus,
): ItemAuditAction {
  if (to === ItemStatus.IN_REPAIR) {
    return ItemAuditAction.SENT_TO_REPAIR;
  }
  if (from === ItemStatus.IN_REPAIR && to === ItemStatus.IN_STOCK) {
    return ItemAuditAction.RETURNED_FROM_REPAIR;
  }
  if (to === ItemStatus.IN_CLEANING) {
    return ItemAuditAction.SENT_TO_CLEANING;
  }
  if (from === ItemStatus.IN_CLEANING && to === ItemStatus.IN_STOCK) {
    return ItemAuditAction.RETURNED_FROM_CLEANING;
  }
  if (to === ItemStatus.ON_COMMISSION) {
    return ItemAuditAction.SENT_TO_COMMISSION;
  }
  if (from === ItemStatus.ON_COMMISSION && to === ItemStatus.IN_STOCK) {
    return ItemAuditAction.RETURNED_FROM_COMMISSION;
  }
  if (to === ItemStatus.SOLD) {
    return ItemAuditAction.SOLD;
  }
  if (from === ItemStatus.SOLD && to === ItemStatus.IN_STOCK) {
    return ItemAuditAction.RETURNED;
  }
  return ItemAuditAction.STATUS_CHANGED;
}

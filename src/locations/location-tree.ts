export function parentWouldCycle(
  locationId: string,
  newParentId: string | null | undefined,
  descendantIds: string[],
): boolean {
  if (!newParentId) {
    return false;
  }
  if (newParentId === locationId) {
    return true;
  }
  return descendantIds.includes(newParentId);
}

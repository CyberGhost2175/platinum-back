/**
 * Receipt numbers are unique per sales location and UTC calendar day.
 * Format: `YYYYMMDD-{first 8 hex chars of locationId}-{seq 4 digits}`.
 * Sequence is allocated atomically from `receipt_sequences` (INSERT … ON CONFLICT).
 * Drafts keep `receipt_number = null` until payment.
 */
export function formatReceiptNumber(
  date: Date,
  locationId: string,
  sequence: number,
): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const loc = locationId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const seq = String(sequence).padStart(4, '0');
  return `${ymd}-${loc}-${seq}`;
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

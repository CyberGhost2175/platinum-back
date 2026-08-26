import { formatReceiptNumber, utcDay } from './receipt-number';

describe('receipt-number', () => {
  it('builds a sequential number unique per location and UTC day', () => {
    const date = new Date('2026-08-25T23:15:00.000Z');
    const locationId = '22222222-2222-4222-8222-222222222222';

    expect(utcDay(date)).toBe('2026-08-25');
    expect(formatReceiptNumber(date, locationId, 1)).toBe(
      '20260825-22222222-0001',
    );
    expect(formatReceiptNumber(date, locationId, 12)).toBe(
      '20260825-22222222-0012',
    );
  });
});

import { AnalyticsPeriod } from './enums/analytics.enums';
import { dateTruncSql, resolvePeriodRange, utcDayString } from './analytics-period';

describe('resolvePeriodRange', () => {
  const now = new Date('2026-08-25T15:00:00.000Z');

  it('defaults a day period to the current UTC day', () => {
    const range = resolvePeriodRange(AnalyticsPeriod.DAY, undefined, undefined, now);
    expect(range.fromDay).toBe('2026-08-25');
    expect(range.toDay).toBe('2026-08-25');
  });

  it('starts a month period on the first UTC day of the month', () => {
    const range = resolvePeriodRange(AnalyticsPeriod.MONTH, undefined, undefined, now);
    expect(range.fromDay).toBe('2026-08-01');
    expect(utcDayString(range.to)).toBe('2026-08-25');
  });

  it('honours an explicit from/to window', () => {
    const range = resolvePeriodRange(
      AnalyticsPeriod.WEEK,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T00:00:00.000Z'),
      now,
    );
    expect(range.fromDay).toBe('2026-01-01');
    expect(range.toDay).toBe('2026-01-31');
  });
});

describe('dateTruncSql', () => {
  it('uses a whitelist for period and column (no string interpolation of user input)', () => {
    expect(dateTruncSql(AnalyticsPeriod.DAY)).toBe('mv.day::text');
    expect(dateTruncSql(AnalyticsPeriod.WEEK)).toContain("date_trunc('week'");
    expect(() =>
      dateTruncSql(AnalyticsPeriod.DAY, "mv.day); DROP TABLE users; --"),
    ).toThrow('Invalid date column');
  });
});

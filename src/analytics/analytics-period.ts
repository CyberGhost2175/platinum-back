import { AnalyticsPeriod } from './enums/analytics.enums';

export interface PeriodRange {
  grain: AnalyticsPeriod;
  from: Date;
  to: Date;
  fromDay: string;
  toDay: string;
}

export function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function resolvePeriodRange(
  period: AnalyticsPeriod,
  from?: Date,
  to?: Date,
  now: Date = new Date(),
): PeriodRange {
  const end = to ? new Date(to) : now;
  let start: Date;
  if (from) {
    start = new Date(from);
  } else if (period === AnalyticsPeriod.DAY) {
    start = startOfUtcDay(now);
  } else if (period === AnalyticsPeriod.WEEK) {
    const day = startOfUtcDay(now);
    const weekday = day.getUTCDay() || 7;
    start = new Date(day.getTime() - (weekday - 1) * 24 * 60 * 60 * 1000);
  } else if (period === AnalyticsPeriod.MONTH) {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }
  if (start.getTime() > end.getTime()) {
    throw new Error('Period "from" must be before "to"');
  }
  return {
    grain: period,
    from: start,
    to: end,
    fromDay: utcDayString(start),
    toDay: utcDayString(end),
  };
}

const DATE_TRUNC_COLUMNS = new Set(['mv.day']);

export function dateTruncSql(period: AnalyticsPeriod, column = 'mv.day'): string {
  if (!DATE_TRUNC_COLUMNS.has(column)) {
    throw new Error('Invalid date column');
  }
  if (period === AnalyticsPeriod.DAY) {
    return `${column}::text`;
  }
  if (
    period !== AnalyticsPeriod.WEEK &&
    period !== AnalyticsPeriod.MONTH &&
    period !== AnalyticsPeriod.YEAR
  ) {
    throw new Error('Invalid analytics period');
  }
  return `to_char(date_trunc('${period}', ${column}::timestamp), 'YYYY-MM-DD')`;
}

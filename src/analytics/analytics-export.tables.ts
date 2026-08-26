import { AnalyticsReport } from './enums/analytics.enums';

export interface ExportTable {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

export function reportToTable(
  report: AnalyticsReport,
  payload: Record<string, unknown>,
  locale: 'ru' | 'en',
): ExportTable {
  if (report === AnalyticsReport.REVENUE) {
    return revenueTable(payload, locale);
  }
  if (report === AnalyticsReport.CATEGORIES) {
    return categoriesTable(payload, locale);
  }
  if (report === AnalyticsReport.MARGIN) {
    return marginTable(payload, locale);
  }
  if (report === AnalyticsReport.SELLERS) {
    return sellersTable(payload, locale);
  }
  return inventoryTable(payload, locale);
}

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

function revenueTable(payload: Record<string, unknown>, locale: 'ru' | 'en'): ExportTable {
  const byBucket = (payload.byBucket as Array<Record<string, number | string>>) ?? [];
  return {
    title: locale === 'ru' ? 'Выручка' : 'Revenue',
    headers:
      locale === 'ru'
        ? ['Период', 'Выручка', 'Чеков', 'Изделий']
        : ['Period', 'Revenue', 'Receipts', 'Items'],
    rows: byBucket.map((row) => [
      String(row.bucket),
      money(Number(row.revenueMinor)),
      Number(row.receiptsCount),
      Number(row.itemsQty),
    ]),
  };
}

function categoriesTable(payload: Record<string, unknown>, locale: 'ru' | 'en'): ExportTable {
  const items = (payload.items as Array<Record<string, number | string>>) ?? [];
  return {
    title: locale === 'ru' ? 'Топ категорий' : 'Top categories',
    headers:
      locale === 'ru'
        ? ['Группа', 'Кол-во', 'Выручка']
        : ['Group', 'Qty', 'Revenue'],
    rows: items.map((row) => [
      String(row.key),
      Number(row.qty),
      money(Number(row.revenueMinor)),
    ]),
  };
}

function marginTable(payload: Record<string, unknown>, locale: 'ru' | 'en'): ExportTable {
  const items = (payload.items as Array<Record<string, unknown>>) ?? [];
  const isReceipt = payload.level === 'receipt';
  return {
    title: locale === 'ru' ? 'Маржинальность' : 'Margin',
    headers: isReceipt
      ? locale === 'ru'
        ? ['Чек', 'Выручка', 'Себестоимость', 'Маржа', 'Маржа %']
        : ['Receipt', 'Revenue', 'Cost', 'Margin', 'Margin %']
      : locale === 'ru'
        ? ['Артикул', 'Название', 'Кол-во', 'Выручка', 'Себестоимость', 'Маржа', 'Маржа %']
        : ['SKU', 'Name', 'Qty', 'Revenue', 'Cost', 'Margin', 'Margin %'],
    rows: items.map((row) =>
      isReceipt
        ? [
            String(row.receiptNumber ?? row.saleId),
            money(Number(row.revenueMinor)),
            money(Number(row.costMinor)),
            money(Number(row.marginMinor)),
            row.marginPercent === null ? '' : Number(row.marginPercent),
          ]
        : [
            String(row.sku),
            String(row.name),
            Number(row.qty),
            money(Number(row.revenueMinor)),
            money(Number(row.costMinor)),
            money(Number(row.marginMinor)),
            row.marginPercent === null ? '' : Number(row.marginPercent),
          ],
    ),
  };
}

function sellersTable(payload: Record<string, unknown>, locale: 'ru' | 'en'): ExportTable {
  const items = (payload.items as Array<Record<string, unknown>>) ?? [];
  return {
    title: locale === 'ru' ? 'Рейтинг продавцов' : 'Seller ranking',
    headers:
      locale === 'ru'
        ? ['Место', 'Продавец', 'Email', 'Чеков', 'Выручка', 'Изделий']
        : ['Rank', 'Seller', 'Email', 'Receipts', 'Revenue', 'Items'],
    rows: items.map((row) => [
      Number(row.rank),
      `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      String(row.email),
      Number(row.receiptsCount),
      money(Number(row.revenueMinor)),
      Number(row.itemsQty),
    ]),
  };
}

function inventoryTable(payload: Record<string, unknown>, locale: 'ru' | 'en'): ExportTable {
  const items = (payload.illiquid as Array<Record<string, unknown>>) ?? [];
  return {
    title: locale === 'ru' ? 'Неликвиды и оборачиваемость' : 'Illiquid stock',
    headers:
      locale === 'ru'
        ? ['Артикул', 'Название', 'Остаток', 'Продано', 'Оборачиваемость %', 'Дней запаса', 'Залежавшийся']
        : ['SKU', 'Name', 'On hand', 'Sold', 'Turnover %', 'Days of supply', 'Stale'],
    rows: items.map((row) => [
      String(row.sku),
      String(row.name),
      Number(row.availableQty),
      Number(row.soldQty),
      Number(row.turnoverRate),
      row.daysOfSupply === null ? '' : Number(row.daysOfSupply),
      row.stale ? (locale === 'ru' ? 'да' : 'yes') : locale === 'ru' ? 'нет' : 'no',
    ]),
  };
}

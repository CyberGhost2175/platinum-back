import { reportToTable } from './analytics-export.tables';
import { AnalyticsReport } from './enums/analytics.enums';
import { AnalyticsExportService } from './analytics-export.service';

describe('analytics export', () => {
  const revenuePayload = {
    byBucket: [
      { bucket: '2026-08-25', revenueMinor: 150000, receiptsCount: 2, itemsQty: 3 },
    ],
  };

  it('flattens a revenue dashboard into spreadsheet rows', () => {
    const table = reportToTable(AnalyticsReport.REVENUE, revenuePayload, 'ru');
    expect(table.headers[0]).toBe('Период');
    expect(table.rows[0]).toEqual(['2026-08-25', '1500.00', 2, 3]);
  });

  it('renders xlsx and pdf buffers from a table', async () => {
    const exporter = new AnalyticsExportService({} as never);
    const table = reportToTable(AnalyticsReport.REVENUE, revenuePayload, 'en');
    const xlsx = await exporter.toXlsx(table);
    const pdf = await exporter.toPdf(table);
    expect(xlsx.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});

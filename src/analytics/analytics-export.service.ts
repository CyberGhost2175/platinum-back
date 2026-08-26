import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { AuthUser } from '../auth/types/auth.types';
import { AnalyticsService } from './analytics.service';
import { AnalyticsExportQueryDto } from './dto/analytics-export-query.dto';
import {
  AnalyticsExportFormat,
  AnalyticsReport,
} from './enums/analytics.enums';
import { reportToTable } from './analytics-export.tables';

export interface AnalyticsExportFile {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

@Injectable()
export class AnalyticsExportService {
  constructor(private readonly analytics: AnalyticsService) {}

  async export(
    user: AuthUser,
    query: AnalyticsExportQueryDto,
  ): Promise<AnalyticsExportFile> {
    const report = query.report;
    const format = query.format ?? AnalyticsExportFormat.XLSX;
    const payload = (await this.analytics.report(user, report, query)) as Record<
      string,
      unknown
    >;
    const table = reportToTable(
      report,
      payload,
      format === AnalyticsExportFormat.PDF ? 'en' : 'ru',
    );
    const day = new Date().toISOString().slice(0, 10);
    if (format === AnalyticsExportFormat.PDF) {
      const buffer = await this.toPdf(table);
      return {
        filename: `analytics-${report}-${day}.pdf`,
        contentType: 'application/pdf',
        buffer,
      };
    }
    const buffer = await this.toXlsx(table);
    return {
      filename: `analytics-${report}-${day}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }

  async toXlsx(table: ReturnType<typeof reportToTable>): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Platinum CRM';
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));
    sheet.addRow(table.headers);
    sheet.getRow(1).font = { bold: true };
    for (const row of table.rows) {
      sheet.addRow(row);
    }
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
    const raw = await workbook.xlsx.writeBuffer();
    return Buffer.from(raw);
  }

  toPdf(table: ReturnType<typeof reportToTable>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(16).text(table.title, { underline: true });
      doc.moveDown();
      doc.fontSize(9);
      doc.text(table.headers.join(' | '));
      doc.moveDown(0.4);
      for (const row of table.rows.slice(0, 40)) {
        doc.text(row.map((cell) => (cell === null ? '' : String(cell))).join(' | '));
      }
      if (table.rows.length > 40) {
        doc.moveDown();
        doc.text(`… ${table.rows.length - 40} more rows`);
      }
      doc.end();
    });
  }
}

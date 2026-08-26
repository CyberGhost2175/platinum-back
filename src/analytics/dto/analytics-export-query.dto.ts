import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';
import { AnalyticsExportFormat, AnalyticsReport } from '../enums/analytics.enums';

export class AnalyticsExportQueryDto extends AnalyticsQueryDto {
  @ApiProperty({ enum: AnalyticsReport })
  @IsEnum(AnalyticsReport)
  report: AnalyticsReport;

  @ApiPropertyOptional({ enum: AnalyticsExportFormat, default: AnalyticsExportFormat.XLSX })
  @IsOptional()
  @IsEnum(AnalyticsExportFormat)
  format?: AnalyticsExportFormat;
}

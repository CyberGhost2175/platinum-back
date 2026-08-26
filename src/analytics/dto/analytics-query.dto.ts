import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { SaleChannel } from '../../sales/enums/sale-channel.enum';
import {
  AnalyticsGroupBy,
  AnalyticsMarginLevel,
  AnalyticsPeriod,
} from '../enums/analytics.enums';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsPeriod, default: AnalyticsPeriod.MONTH })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ enum: SaleChannel })
  @IsOptional()
  @IsEnum(SaleChannel)
  channel?: SaleChannel;

  @ApiPropertyOptional({ enum: AnalyticsGroupBy, default: AnalyticsGroupBy.ITEM_CATEGORY })
  @IsOptional()
  @IsEnum(AnalyticsGroupBy)
  groupBy?: AnalyticsGroupBy;

  @ApiPropertyOptional({ enum: AnalyticsMarginLevel, default: AnalyticsMarginLevel.PRODUCT })
  @IsOptional()
  @IsEnum(AnalyticsMarginLevel)
  level?: AnalyticsMarginLevel;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { GoldTone } from '../../products/enums/gold-tone.enum';
import { ItemCategory } from '../../products/enums/item-category.enum';
import { MetalCategory } from '../../products/enums/metal-category.enum';

export enum StockReportScope {
  AVAILABLE = 'available',
  IN_STOCK = 'in_stock',
  ON_DISPLAY = 'on_display',
}

export class StockReportQueryDto {
  @ApiPropertyOptional({ enum: MetalCategory })
  @IsOptional()
  @IsEnum(MetalCategory)
  metalCategory?: MetalCategory;

  @ApiPropertyOptional({ enum: ItemCategory })
  @IsOptional()
  @IsEnum(ItemCategory)
  itemCategory?: ItemCategory;

  @ApiPropertyOptional({ enum: GoldTone })
  @IsOptional()
  @IsEnum(GoldTone)
  goldTone?: GoldTone;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    enum: StockReportScope,
    default: StockReportScope.AVAILABLE,
    description: 'available — склад + витрина, in_stock — только склад, on_display — только витрина',
  })
  @IsOptional()
  @IsEnum(StockReportScope)
  scope?: StockReportScope;

  /** Ignored: leftover query from the old warehouse UI. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  stale?: boolean;

  @ApiPropertyOptional({ description: 'Поиск по артикулу, названию, поставщику' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  productLimit?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GoldTone } from '../enums/gold-tone.enum';
import { ItemCategory } from '../enums/item-category.enum';
import { MetalCategory } from '../enums/metal-category.enum';
import { StockAvailability } from '../enums/stock-availability.enum';

export const PRODUCT_SORT_FIELDS = [
  'name',
  'price',
  'createdAt',
  'sku',
  'availableQty',
  'weight',
  'supplier',
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export class ProductFilterQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ example: '10000.00' })
  @IsOptional()
  @IsNumberString()
  priceMin?: string;

  @ApiPropertyOptional({ example: '80000.00' })
  @IsOptional()
  @IsNumberString()
  priceMax?: string;

  @ApiPropertyOptional({ enum: StockAvailability })
  @IsOptional()
  @IsEnum(StockAvailability)
  stockStatus?: StockAvailability;

  @ApiPropertyOptional({
    description:
      'Товары с нераспроданными единицами старше порога STALE_ITEM_DAYS',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  stale?: boolean;

  @ApiPropertyOptional({ description: 'Поиск по SKU или названию (фильтр списка)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: PRODUCT_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy?: ProductSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

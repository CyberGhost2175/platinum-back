import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { ItemCategory } from '../../products/enums/item-category.enum';
import { MetalCategory } from '../../products/enums/metal-category.enum';
import { ItemStatus } from '../enums/item-status.enum';

export const ITEM_SORT_FIELDS = [
  'createdAt',
  'name',
  'price',
  'sku',
  'weight',
  'supplier',
] as const;

export type ItemSortField = (typeof ITEM_SORT_FIELDS)[number];

export class ItemFilterQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: ItemStatus })
  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @ApiPropertyOptional({ enum: MetalCategory })
  @IsOptional()
  @IsEnum(MetalCategory)
  metalCategory?: MetalCategory;

  @ApiPropertyOptional({ enum: ItemCategory })
  @IsOptional()
  @IsEnum(ItemCategory)
  itemCategory?: ItemCategory;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Поиск по бирке, артикулу, названию, поставщику' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @SanitizeText()
  q?: string;

  @ApiPropertyOptional({ enum: ITEM_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(ITEM_SORT_FIELDS)
  sortBy?: ItemSortField;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductFilterQueryDto } from '../../products/dto/product-filter-query.dto';

export enum CatalogPromotionKind {
  LOW = 'low',
  STALE = 'stale',
}

export class CatalogPromotionsQueryDto extends ProductFilterQueryDto {
  @ApiPropertyOptional({
    enum: CatalogPromotionKind,
    description: 'Только низкий остаток или только залежавшиеся. Без kind — оба списка.',
  })
  @IsOptional()
  @IsEnum(CatalogPromotionKind)
  kind?: CatalogPromotionKind;
}

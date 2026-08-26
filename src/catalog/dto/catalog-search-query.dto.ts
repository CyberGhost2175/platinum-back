import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../search/catalog-search.types';

export class CatalogSearchQueryDto {
  @ApiProperty({
    description:
      'Артикул/штрихкод (точное совпадение, приоритет), название или поставщик (частичное)',
    example: '2000000000001',
  })
  @IsString()
  @SanitizeText()
  @MinLength(1)
  @MaxLength(120)
  q: string;

  @ApiPropertyOptional({ default: DEFAULT_SEARCH_LIMIT, maximum: MAX_SEARCH_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class AddDraftItemDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Конкретная бирка' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  qty?: number;

  @ApiPropertyOptional({ description: 'Скидка позиции в копейках' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountMinor?: number;

  @ApiPropertyOptional({ description: 'Скидка позиции в процентах', maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 'SALE10' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @SanitizeText()
  promoCode?: string;
}

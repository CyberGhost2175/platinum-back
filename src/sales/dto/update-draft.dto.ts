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

export class UpdateDraftDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Скидка чека в копейках' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountMinor?: number;

  @ApiPropertyOptional({ maximum: 100 })
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

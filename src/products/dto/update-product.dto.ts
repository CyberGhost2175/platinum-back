import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { GoldTone } from '../enums/gold-tone.enum';
import { ItemCategory } from '../enums/item-category.enum';
import { MetalCategory } from '../enums/metal-category.enum';

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @SanitizeText()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeText()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  weight?: string;

  @ApiPropertyOptional({ enum: MetalCategory })
  @IsOptional()
  @IsEnum(MetalCategory)
  metalCategory?: MetalCategory;

  @ApiPropertyOptional({
    enum: GoldTone,
    nullable: true,
    description:
      'Цвет золота: red — красное, yellow — жёлтое, white — белое. Не «золотое». Только при metalCategory=gold.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(GoldTone)
  goldTone?: GoldTone | null;

  @ApiPropertyOptional({ enum: ItemCategory })
  @IsOptional()
  @IsEnum(ItemCategory)
  itemCategory?: ItemCategory;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumberString()
  price?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Себестоимость' })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumberString()
  costPrice?: string | null;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ enum: GoldTone, nullable: true })
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
  @IsOptional()
  @IsNumberString()
  price?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Себестоимость' })
  @IsOptional()
  @IsNumberString()
  costPrice?: string | null;
}

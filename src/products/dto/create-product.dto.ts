import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { GoldTone } from '../enums/gold-tone.enum';
import { ItemCategory } from '../enums/item-category.enum';
import { MetalCategory } from '../enums/metal-category.enum';

export class CreateProductDto {
  @ApiPropertyOptional({
    example: 'PT-000042',
    description:
      'Читаемый артикул. Если не передан — сервер выдаст PT-000001, PT-000002, …',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @SanitizeText()
  sku?: string;

  @ApiProperty({ example: 'Кольцо 585' })
  @IsString()
  @MaxLength(255)
  @SanitizeText()
  name: string;

  @ApiProperty({ example: '2.350', description: 'Вес в граммах' })
  @IsNumberString()
  weight: string;

  @ApiProperty({ enum: MetalCategory })
  @IsEnum(MetalCategory)
  metalCategory: MetalCategory;

  @ApiPropertyOptional({ enum: GoldTone, nullable: true })
  @IsOptional()
  @IsEnum(GoldTone)
  goldTone?: GoldTone | null;

  @ApiProperty({ enum: ItemCategory })
  @IsEnum(ItemCategory)
  itemCategory: ItemCategory;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ example: '45990.00', nullable: true })
  @IsOptional()
  @IsNumberString()
  price?: string | null;

  @ApiPropertyOptional({ example: '22100.00', nullable: true, description: 'Себестоимость' })
  @IsOptional()
  @IsNumberString()
  costPrice?: string | null;
}

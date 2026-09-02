import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

  @ApiPropertyOptional({
    enum: GoldTone,
    nullable: true,
    description:
      'Цвет золота: red — красное, yellow — жёлтое, white — белое. Не «золотое». Только при metalCategory=gold.',
  })
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
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumberString()
  price?: string | null;

  @ApiPropertyOptional({ example: '22100.00', nullable: true, description: 'Себестоимость' })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumberString()
  costPrice?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Сколько физических единиц положить на склад. По умолчанию 1, иначе товар не виден в фильтрах in_stock / на кассе.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  qty?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Куда положить остаток. По умолчанию — склад (или первая точка).',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

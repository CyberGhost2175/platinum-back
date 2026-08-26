import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class ReceiveBatchItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'TAG-000123', description: 'Уникальная бирка' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @SanitizeText()
  uniqueTag: string;
}

export class ReceiveBatchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'По умолчанию — центральный склад',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({ type: [ReceiveBatchItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveBatchItemDto)
  items: ReceiveBatchItemDto[];
}

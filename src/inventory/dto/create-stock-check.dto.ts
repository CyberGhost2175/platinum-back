import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { sanitizeText } from '../../common/sanitize-text';

export class CreateStockCheckDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId: string;

  @ApiProperty({
    type: [String],
    description: 'Отсканированные бирки',
    example: ['TAG-000123', 'TAG-000124'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((tag: unknown) => sanitizeText(tag)) : value,
  )
  scannedTags: string[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @SanitizeText()
  note?: string;
}

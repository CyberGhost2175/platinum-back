import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class MoveItemDto {
  @ApiProperty({ format: 'uuid', description: 'Целевая локация' })
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  comment?: string;
}

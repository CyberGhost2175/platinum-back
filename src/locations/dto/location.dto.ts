import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { LocationType } from '../enums/location-type.enum';

export class CreateLocationDto {
  @ApiProperty({ example: 'Центральный склад' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @SanitizeText()
  name: string;

  @ApiProperty({ enum: LocationType })
  @IsEnum(LocationType)
  type: LocationType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Родитель: склад → салон → витрина',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @SanitizeText()
  name?: string;

  @ApiPropertyOptional({ enum: LocationType })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;
}

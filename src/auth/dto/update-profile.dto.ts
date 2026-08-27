import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Anna' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @SanitizeText()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Ivanova' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @SanitizeText()
  lastName?: string;

  @ApiPropertyOptional({ example: 'anna@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+77001234567', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Точка продаж. Менять может только admin.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  locationId?: string | null;
}

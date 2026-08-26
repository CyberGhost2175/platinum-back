import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Ювелирторг' })
  @IsString()
  @MaxLength(255)
  @SanitizeText()
  name: string;

  @ApiPropertyOptional({ example: '+78121230000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: 'sales@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeText()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

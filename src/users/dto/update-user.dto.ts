import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'manager@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Ivan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @SanitizeText()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @SanitizeText()
  lastName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: '+79001112235', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  locationId?: string | null;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

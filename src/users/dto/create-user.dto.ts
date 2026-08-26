import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'manager@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'manager12' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Ivan' })
  @IsString()
  @MaxLength(100)
  @SanitizeText()
  firstName: string;

  @ApiProperty({ example: 'Manager' })
  @IsString()
  @MaxLength(100)
  @SanitizeText()
  lastName: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: '+79001112235' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

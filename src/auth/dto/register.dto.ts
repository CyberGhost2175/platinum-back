import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'new.cashier@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'password1' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Anna' })
  @IsString()
  @MaxLength(100)
  @SanitizeText()
  firstName: string;

  @ApiProperty({ example: 'Cashier' })
  @IsString()
  @MaxLength(100)
  @SanitizeText()
  lastName: string;

  @ApiPropertyOptional({ example: '+79001112233' })
  @IsOptional()
  @IsString()
  phone?: string;
}

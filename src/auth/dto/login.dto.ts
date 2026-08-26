import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'cashier@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'cashier12' })
  @IsString()
  @MinLength(8)
  password: string;
}

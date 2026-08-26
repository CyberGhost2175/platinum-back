import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, example: 'newpass12' })
  @IsString()
  @MinLength(8)
  password: string;
}

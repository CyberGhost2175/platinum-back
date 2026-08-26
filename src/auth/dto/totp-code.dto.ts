import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TotpCodeDto {
  @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

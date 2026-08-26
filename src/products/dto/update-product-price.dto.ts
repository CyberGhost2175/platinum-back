import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductPriceDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '45990.00',
    description: 'Цена в рублях. null — сбросить цену.',
  })
  @IsOptional()
  @IsString()
  price: string | null;
}

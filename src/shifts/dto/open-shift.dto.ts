import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class OpenShiftDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Точка продаж. По умолчанию — locationId пользователя.',
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

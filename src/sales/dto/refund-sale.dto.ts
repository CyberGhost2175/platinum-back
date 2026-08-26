import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';

export class RefundSaleDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  reason?: string;
}

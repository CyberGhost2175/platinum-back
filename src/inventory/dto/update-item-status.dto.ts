import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SanitizeText } from '../../common/decorators/sanitize-text.decorator';
import { ItemStatus } from '../enums/item-status.enum';

export class UpdateItemStatusDto {
  @ApiProperty({ enum: ItemStatus })
  @IsEnum(ItemStatus)
  status: ItemStatus;

  @ApiPropertyOptional({
    description: 'Причина / комментарий (ремонт, чистка, комиссия)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @SanitizeText()
  comment?: string;
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/types/auth.types';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { ApiLocationQuery } from '../common/decorators/api-location-query.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireLocation } from '../common/decorators/require-location.decorator';
import { ApiAccessRoles } from '../common/decorators/require-permission.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SHIFT_ACCESS_ROLES } from '../common/write-endpoints';
import { resolveLocationScope } from '../common/location-scope';
import { OpenShiftDto } from './dto/open-shift.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiAuth()
@Controller('shifts')
@Roles(...SHIFT_ACCESS_ROLES)
@ApiAccessRoles(...SHIFT_ACCESS_ROLES)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @RequireLocation()
  @ApiOperation({
    summary: 'Открыть смену',
    description:
      'Создаёт Shift со статусом open, привязанный к кассиру и точке. Повторное открытие без закрытия предыдущей смены — 400.',
  })
  @ApiCreatedResponse({ description: 'Открытая смена' })
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenShiftDto = {}) {
    return this.shiftsService.open(user, dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Закрыть смену',
    description:
      'Считает итог (нал/карта, число чеков, средний чек), переводит статус в closed. Неоплаченные черновики чеков сбрасываются.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Закрытая смена со сводкой' })
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shiftsService.close(id, user);
  }

  @Get('current')
  @ApiOperation({
    summary: 'Текущая смена',
    description:
      'Статус, нарастающий итог нал/карта, число чеков, средний чек, число проданных изделий, список чеков.',
  })
  @ApiOkResponse({ description: 'Состояние открытой смены' })
  current(@CurrentUser() user: AuthUser) {
    return this.shiftsService.getCurrent(user);
  }

  @Get()
  @RequireLocation()
  @ApiLocationQuery()
  @ApiOperation({ summary: 'Список смен по точке' })
  @ApiOkResponse({ description: 'Смены' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
  ) {
    return this.shiftsService.findAll(resolveLocationScope(user, locationId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Смена по id со сводкой и чеками' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Смена' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shiftsService.getById(id, user);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/types/auth.types';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { ApiLocationQuery } from '../common/decorators/api-location-query.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireLocation } from '../common/decorators/require-location.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { resolveLocationScope } from '../common/location-scope';
import { AddDraftItemDto } from './dto/add-draft-item.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { PayDraftDto } from './dto/pay-draft.dto';
import { RefundSaleDto } from './dto/refund-sale.dto';
import { UpdateDraftDto } from './dto/update-draft.dto';
import { UpdateDraftItemDto } from './dto/update-draft-item.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiAuth()
@Controller('sales')
@AuditLog('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('drafts')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @ApiOperation({
    summary: 'Создать черновик чека',
    description:
      'Редактируемый draft до оплаты. Требует открытую смену кассира.',
  })
  @ApiCreatedResponse({ description: 'Черновик чека' })
  createDraft(@CurrentUser() user: AuthUser, @Body() dto: CreateDraftDto) {
    return this.salesService.createDraft(user, dto);
  }

  @Patch('drafts/:id')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @ApiOperation({
    summary: 'Скидка / промокод на чек',
    description: 'Скидка чека и промокоды SALE10 (10%) и VIP500 (500 ₽).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Обновлённый черновик' })
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.salesService.updateDraft(id, user, dto);
  }

  @Post('drafts/:id/items')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @ApiOperation({
    summary: 'Добавить позицию в черновик',
    description:
      'По itemId (конкретная бирка, qty = 1) или productId (N доступных единиц на точке смены). Нельзя добавить товар с остатком 0 / «нет в наличии».',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Черновик с позициями' })
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddDraftItemDto,
  ) {
    return this.salesService.addItem(id, user, dto);
  }

  @Patch('drafts/:id/items/:lineId')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @ApiOperation({ summary: 'Изменить скидку/промокод позиции' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'lineId', format: 'uuid' })
  @ApiOkResponse({ description: 'Черновик' })
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateDraftItemDto,
  ) {
    return this.salesService.updateItem(id, lineId, user, dto);
  }

  @Delete('drafts/:id/items/:lineId')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @ApiOperation({ summary: 'Удалить позицию из черновика' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'lineId', format: 'uuid' })
  @ApiOkResponse({ description: 'Черновик' })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.salesService.removeItem(id, lineId, user);
  }

  @Delete('drafts/:id')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отменить черновик чека' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Черновик удалён' })
  cancelDraft(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.cancelDraft(id, user);
  }

  @Post('drafts/:id/pay')
  @RequirePermission(PermissionResource.SALES, CrudAction.CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Произвести оплату',
    description:
      'Фиксирует черновик как Sale. В одной транзакции с SELECT … FOR UPDATE: списывает Item, обновляет итог смены (нал/карта), при нулевом остатке помечает товар «нет в наличии». Номер чека: YYYYMMDD-{8 hex локации}-{seq} уникален в рамках точки и UTC-дня.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Оплаченный чек' })
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PayDraftDto,
  ) {
    return this.salesService.pay(id, user, dto);
  }

  @Post(':id/refund')
  @RequirePermission(PermissionResource.SALES, CrudAction.UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Сторно / возврат',
    description:
      'Пока смена открыта: восстанавливает остаток изделий и корректирует итог смены в одной транзакции.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Чек со статусом refunded' })
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RefundSaleDto,
  ) {
    return this.salesService.refund(id, user, dto);
  }

  @Get()
  @RequirePermission(PermissionResource.SALES, CrudAction.READ)
  @RequireLocation()
  @ApiLocationQuery()
  @ApiOperation({ summary: 'Список продаж по точке' })
  @ApiOkResponse({ description: 'Продажи' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
  ) {
    return this.salesService.findAll(resolveLocationScope(user, locationId));
  }

  @Get(':id')
  @RequirePermission(PermissionResource.SALES, CrudAction.READ)
  @ApiOperation({ summary: 'Чек по id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Продажа' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.getById(id, user);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { ItemFilterQueryDto } from './dto/item-filter-query.dto';
import { MoveItemDto } from './dto/move-item.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { InventoryService } from './inventory.service';

@ApiTags('items')
@ApiAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @RequireLocation()
  @ApiLocationQuery()
  @ApiOperation({ summary: 'Список физических единиц (бирки) с пагинацией' })
  @ApiOkResponse({ description: 'Страница изделий' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ItemFilterQueryDto,
  ) {
    return this.inventoryService.findItems(
      {
        ...query,
        locationId: resolveLocationScope(user, query.locationId),
      },
      user,
    );
  }

  @Get(':id/history')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({ summary: 'История движения и статусов единицы' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inventoryService.getHistory(id, user);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({ summary: 'Карточка единицы товара' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inventoryService.getItem(id, user);
  }

  @Patch(':id/status')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.UPDATE)
  @AuditLog('inventory_status')
  @ApiOperation({
    summary: 'Сменить статус единицы',
    description:
      'Ремонт, чистка, комиссия, витрина, возврат на склад. Продажа — через модуль продаж.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.inventoryService.updateStatus(id, dto, user);
  }

  @Post(':id/move')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.UPDATE)
  @AuditLog('inventory_move')
  @ApiOperation({
    summary: 'Переместить единицу между локациями',
    description: 'Склад → магазин → витрина. Пишет запись в историю.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Единица на новой локации' })
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveItemDto,
  ) {
    return this.inventoryService.moveItem(id, dto, user);
  }
}

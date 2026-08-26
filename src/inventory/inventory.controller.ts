import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @RequireLocation()
  @ApiLocationQuery()
  @ApiOperation({ summary: 'Список изделий (алиас /items)' })
  @ApiOkResponse({ description: 'Изделия' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
  ) {
    return this.inventoryService.findAll(
      resolveLocationScope(user, locationId),
    );
  }

  @Get('stock')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @RequireLocation()
  @ApiLocationQuery()
  @ApiOperation({ summary: 'Сводка остатков' })
  @ApiOkResponse({ description: 'Доступно и разбивка по товарам' })
  stockSummary(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
  ) {
    return this.inventoryService.stockSummary(
      resolveLocationScope(user, locationId),
      user,
    );
  }

  @Patch(':id/status')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.UPDATE)
  @AuditLog('inventory_status')
  @ApiOperation({ summary: 'Изменить статус изделия (алиас PATCH /items/:id/status)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Обновлённое изделие' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.inventoryService.updateStatus(id, dto, user);
  }
}

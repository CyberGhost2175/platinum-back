import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreateStockCheckDto } from './dto/create-stock-check.dto';
import { InventoryService } from './inventory.service';

@ApiTags('stock-checks')
@ApiAuth()
@Controller('stock-checks')
export class StockChecksController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @RequireLocation()
  @ApiLocationQuery()
  @ApiOperation({ summary: 'Список актов инвентаризации' })
  @ApiOkResponse({ description: 'Акты с расхождениями' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
  ) {
    return this.inventoryService.listStockChecks(
      resolveLocationScope(user, locationId),
      user,
    );
  }

  @Post()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.CREATE)
  @RequireLocation()
  @AuditLog('inventory_stock_check')
  @ApiOperation({
    summary: 'Провести инвентаризацию',
    description:
      'Сверяет отсканированные бирки с учётными остатками локации. Транзакция с блокировкой строк.',
  })
  @ApiCreatedResponse({ description: 'Акт и список missing/extra' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockCheckDto) {
    return this.inventoryService.createStockCheck(dto, user);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({ summary: 'Акт инвентаризации с расхождениями' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inventoryService.getStockCheck(id, user);
  }
}

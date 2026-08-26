import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { ReceiveBatchDto } from './dto/receive-batch.dto';
import { InventoryService } from './inventory.service';

@ApiTags('batches')
@ApiAuth()
@Controller('batches')
export class BatchesController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.CREATE)
  @AuditLog('inventory_receipt')
  @ApiOperation({
    summary: 'Приёмка партии',
    description:
      'Создаёт Batch, Item по биркам и ставит их на указанную локацию (по умолчанию центральный склад). Транзакция.',
  })
  @ApiCreatedResponse({ description: 'Партия с созданными единицами' })
  receive(@CurrentUser() user: AuthUser, @Body() dto: ReceiveBatchDto) {
    return this.inventoryService.receiveBatch(dto, user);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.PRODUCTS_INVENTORY, CrudAction.READ)
  @ApiOperation({ summary: 'Партия с составом' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Партия' })
  findOne(@Param('id') id: string) {
    return this.inventoryService.getBatch(id);
  }
}

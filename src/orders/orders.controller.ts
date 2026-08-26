import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermission(PermissionResource.ONLINE_ORDERS, CrudAction.READ)
  @ApiOperation({ summary: 'Список онлайн-заказов' })
  @ApiOkResponse({ description: 'Заказы' })
  findAll() {
    return this.ordersService.findAll();
  }
}

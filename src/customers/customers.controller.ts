import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermission(PermissionResource.CUSTOMERS, CrudAction.READ)
  @ApiOperation({ summary: 'Список клиентов' })
  @ApiOkResponse({ description: 'Клиенты' })
  findAll() {
    return this.customersService.findAll();
  }
}

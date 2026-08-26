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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.READ)
  @ApiOperation({
    summary: 'Список поставщиков (admin)',
    description: 'Включая неактивных. Витрина кассы — GET /api/catalog/suppliers.',
  })
  @ApiQuery({ name: 'includeInactive', required: false })
  @ApiOkResponse({ description: 'Поставщики' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.suppliers.findAll(includeInactive !== 'false');
  }

  @Post()
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.CREATE)
  @AuditLog('suppliers')
  @ApiOperation({ summary: 'Создать поставщика (admin)' })
  @ApiCreatedResponse({ description: 'Поставщик' })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.READ)
  @ApiOperation({ summary: 'Карточка поставщика' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id') id: string) {
    return this.suppliers.findById(id);
  }

  @Patch(':id')
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.UPDATE)
  @AuditLog('suppliers')
  @ApiOperation({ summary: 'Обновить поставщика (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.DELETE)
  @AuditLog('suppliers')
  @ApiOperation({
    summary: 'Удалить поставщика',
    description:
      'Можно удалить, если на складе нет товаров поставщика. Если по товарам уже были продажи — 409, деактивируйте isActive=false.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.suppliers.remove(id);
  }
}

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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@ApiAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({
    summary: 'Список складов, салонов и витрин',
    description:
      'Admin и warehouse видят все точки. Остальные — свою точку и дочерние. Писать может только admin.',
  })
  @ApiOkResponse({ description: 'Локации' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.locations.findAllForUser(user);
  }

  @Post()
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.CREATE)
  @AuditLog('locations')
  @ApiOperation({ summary: 'Создать склад / салон / витрину (admin)' })
  @ApiCreatedResponse({ description: 'Локация' })
  create(@Body() dto: CreateLocationDto) {
    return this.locations.create(dto);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.CATALOG, CrudAction.READ)
  @ApiOperation({ summary: 'Карточка точки' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.locations.findOneForUser(user, id);
  }

  @Patch(':id')
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.UPDATE)
  @AuditLog('locations')
  @ApiOperation({ summary: 'Обновить точку (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionResource.SETTINGS, CrudAction.DELETE)
  @AuditLog('locations')
  @ApiOperation({
    summary: 'Удалить точку (admin)',
    description:
      'Нельзя, если есть дочерние точки, сотрудники, изделия, продажи или смены.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.locations.remove(id);
  }
}

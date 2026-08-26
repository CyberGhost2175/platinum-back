import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { AuthUser } from '../auth/types/auth.types';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CrudAction,
  PermissionResource,
} from '../common/constants/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermission(PermissionResource.USERS, CrudAction.READ)
  @ApiOperation({ summary: 'Список пользователей (admin)' })
  @ApiOkResponse({ description: 'Пользователи без passwordHash и totpSecret' })
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @RequirePermission(PermissionResource.USERS, CrudAction.CREATE)
  @AuditLog('users')
  @ApiOperation({ summary: 'Создать пользователя (admin)' })
  @ApiCreatedResponse({ description: 'Созданный пользователь' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @RequirePermission(PermissionResource.USERS, CrudAction.READ)
  @ApiOperation({ summary: 'Карточка сотрудника (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Пользователь без passwordHash и totpSecret' })
  findOne(@Param('id') id: string) {
    return this.usersService.findSafeById(id);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionResource.USERS, CrudAction.UPDATE)
  @AuditLog('users')
  @ApiOperation({
    summary: 'Задать пароль пользователю (admin, в том числе себе)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async setPassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(id, dto.password);
  }

  @Patch(':id')
  @RequirePermission(PermissionResource.USERS, CrudAction.UPDATE)
  @AuditLog('users')
  @ApiOperation({
    summary: 'Обновить email, ФИО, роль, статус и точку (admin)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Обновлённый пользователь' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionResource.USERS, CrudAction.DELETE)
  @AuditLog('users')
  @ApiOperation({
    summary: 'Удалить пользователя (admin)',
    description:
      'Нельзя удалить себя, последнего admin и пользователя со сменами/продажами/инвентаризациями.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<void> {
    await this.usersService.remove(id, actor.id);
  }
}

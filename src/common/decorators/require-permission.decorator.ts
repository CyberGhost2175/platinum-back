import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension, ApiForbiddenResponse } from '@nestjs/swagger';
import {
  CrudAction,
  PermissionResource,
  rolesWithPermission,
} from '../constants/permissions';
import { UserRole } from '../enums/user-role.enum';
import { Roles } from './roles.decorator';

export const PERMISSION_KEY = 'permission';

export interface RequiredPermission {
  resource: PermissionResource;
  action: CrudAction;
}

export const ApiAccessRoles = (...roles: UserRole[]) =>
  applyDecorators(
    ApiExtension('x-access-roles', roles),
    ApiForbiddenResponse({
      description: `Недостаточно прав. Разрешено: ${roles.join(', ')}`,
    }),
  );

/**
 * CRUD-матрица + RolesGuard: write/read эндпоинт доступен только ролям из ROLE_PERMISSIONS.
 */
export const RequirePermission = (
  resource: PermissionResource,
  action: CrudAction,
) => {
  const roles = rolesWithPermission(resource, action);
  if (roles.length === 0) {
    throw new Error(`No roles are allowed to ${action} on ${resource}`);
  }
  return applyDecorators(
    SetMetadata(PERMISSION_KEY, {
      resource,
      action,
    } satisfies RequiredPermission),
    Roles(...roles),
    ApiAccessRoles(...roles),
  );
};

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CrudAction,
  hasPermission,
  PermissionResource,
  rolesWithPermission,
} from '../constants/permissions';
import { SHIFT_ACCESS_ROLES, WRITE_ENDPOINTS } from '../write-endpoints';
import { UserRole } from '../enums/user-role.enum';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

function contextWithRole(role: UserRole) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as never;
}

describe('access matrix — 403 for forbidden role → write endpoint', () => {
  const cases: Array<{
    method: string;
    path: string;
    role: UserRole;
    allowed: boolean;
    resource: PermissionResource;
    action: CrudAction;
  }> = [];

  for (const endpoint of WRITE_ENDPOINTS) {
    for (const role of Object.values(UserRole)) {
      cases.push({
        ...endpoint,
        role,
        allowed: hasPermission(role, endpoint.resource, endpoint.action),
      });
    }
  }

  it.each(cases.filter((row) => !row.allowed))(
    '403 $role $method $path',
    ({ role, resource, action }) => {
      const permissions = new PermissionsGuard({
        getAllAndOverride: jest.fn().mockReturnValue({ resource, action }),
      } as unknown as Reflector);
      const rolesGuard = new RolesGuard({
        getAllAndOverride: jest
          .fn()
          .mockReturnValue(rolesWithPermission(resource, action)),
      } as unknown as Reflector);

      expect(() => permissions.canActivate(contextWithRole(role))).toThrow(
        ForbiddenException,
      );
      expect(() => rolesGuard.canActivate(contextWithRole(role))).toThrow(
        ForbiddenException,
      );
    },
  );

  it.each(cases.filter((row) => row.allowed))(
    'allows $role $method $path',
    ({ role, resource, action }) => {
      const permissions = new PermissionsGuard({
        getAllAndOverride: jest.fn().mockReturnValue({ resource, action }),
      } as unknown as Reflector);
      const rolesGuard = new RolesGuard({
        getAllAndOverride: jest
          .fn()
          .mockReturnValue(rolesWithPermission(resource, action)),
      } as unknown as Reflector);

      expect(permissions.canActivate(contextWithRole(role))).toBe(true);
      expect(rolesGuard.canActivate(contextWithRole(role))).toBe(true);
    },
  );

  it.each([
    [UserRole.ONLINE_MANAGER, 'POST', '/api/shifts/open'],
    [UserRole.WAREHOUSE, 'POST', '/api/shifts/open'],
    [UserRole.ONLINE_MANAGER, 'POST', '/api/shifts/:id/close'],
    [UserRole.WAREHOUSE, 'POST', '/api/shifts/:id/close'],
  ] as const)('403 %s %s %s (shifts)', (role, _method, _path) => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue([...SHIFT_ACCESS_ROLES]),
    } as unknown as Reflector);
    expect(() => guard.canActivate(contextWithRole(role))).toThrow(
      ForbiddenException,
    );
  });

  it('cashier cannot refund or create products; warehouse cannot pay', () => {
    expect(
      hasPermission(UserRole.CASHIER, PermissionResource.SALES, CrudAction.UPDATE),
    ).toBe(false);
    expect(
      hasPermission(
        UserRole.CASHIER,
        PermissionResource.PRODUCTS_INVENTORY,
        CrudAction.CREATE,
      ),
    ).toBe(false);
    expect(
      hasPermission(UserRole.WAREHOUSE, PermissionResource.SALES, CrudAction.CREATE),
    ).toBe(false);
    expect(
      hasPermission(
        UserRole.STORE_MANAGER,
        PermissionResource.USERS,
        CrudAction.CREATE,
      ),
    ).toBe(false);
  });
});

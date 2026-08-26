import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CrudAction, PermissionResource } from '../constants/permissions';
import { UserRole } from '../enums/user-role.enum';
import { PermissionsGuard } from './permissions.guard';

function contextWithRole(role?: UserRole): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  it('allows when no permission is required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(contextWithRole(UserRole.CASHIER))).toBe(true);
  });

  it('returns 403 when the role lacks the CRUD action', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      resource: PermissionResource.USERS,
      action: CrudAction.READ,
    });
    expect(() =>
      guard.canActivate(contextWithRole(UserRole.CASHIER)),
    ).toThrow(ForbiddenException);
  });

  it('allows an admin to read users', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      resource: PermissionResource.USERS,
      action: CrudAction.READ,
    });
    expect(guard.canActivate(contextWithRole(UserRole.ADMIN))).toBe(true);
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { RolesGuard } from './roles.guard';

function contextWithRole(role?: UserRole): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(contextWithRole(UserRole.CASHIER))).toBe(true);
  });

  it('returns 403 when the role is insufficient', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    expect(() =>
      guard.canActivate(contextWithRole(UserRole.CASHIER)),
    ).toThrow(ForbiddenException);
  });

  it('allows an admin on an admin-only route', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    expect(guard.canActivate(contextWithRole(UserRole.ADMIN))).toBe(true);
  });
});

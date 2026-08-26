import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { LocationsService } from '../../locations/locations.service';
import { LocationGuard } from './location.guard';

function contextWith(opts: {
  role: UserRole;
  userLocationId: string | null;
  queryLocationId?: string;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: 'u1',
          email: 'user@example.com',
          role: opts.role,
          locationId: opts.userLocationId,
        },
        params: {},
        query: opts.queryLocationId
          ? { locationId: opts.queryLocationId }
          : {},
        body: {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('LocationGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(true),
  } as unknown as Reflector;
  const locations = {
    isAccessible: jest.fn(
      async (user: { role: UserRole; locationId: string | null }, locationId: string) => {
        if (user.role === UserRole.ADMIN || user.role === UserRole.WAREHOUSE) {
          return true;
        }
        return user.locationId === locationId;
      },
    ),
  } as unknown as LocationsService;
  const guard = new LocationGuard(reflector, locations);

  it('allows admin to access any location', async () => {
    await expect(
      guard.canActivate(
        contextWith({
          role: UserRole.ADMIN,
          userLocationId: 'store-a',
          queryLocationId: 'store-b',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows warehouse to access any location', async () => {
    await expect(
      guard.canActivate(
        contextWith({
          role: UserRole.WAREHOUSE,
          userLocationId: 'warehouse',
          queryLocationId: 'store-b',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('allows a store manager to access their own location', async () => {
    await expect(
      guard.canActivate(
        contextWith({
          role: UserRole.STORE_MANAGER,
          userLocationId: 'store-a',
          queryLocationId: 'store-a',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('denies a store manager access to another sales location', async () => {
    await expect(
      guard.canActivate(
        contextWith({
          role: UserRole.STORE_MANAGER,
          userLocationId: 'store-a',
          queryLocationId: 'store-b',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

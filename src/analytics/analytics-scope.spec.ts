import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { SaleChannel } from '../sales/enums/sale-channel.enum';
import { resolveAnalyticsScope } from './analytics-scope';
import { AuthUser } from '../auth/types/auth.types';

const admin: AuthUser = {
  id: 'a',
  email: 'a@x',
  role: UserRole.ADMIN,
  locationId: null,
};
const manager: AuthUser = {
  id: 'm',
  email: 'm@x',
  role: UserRole.STORE_MANAGER,
  locationId: 'store-1',
};
const online: AuthUser = {
  id: 'o',
  email: 'o@x',
  role: UserRole.ONLINE_MANAGER,
  locationId: null,
};

describe('resolveAnalyticsScope', () => {
  it('gives admin all locations and optional channel', () => {
    expect(resolveAnalyticsScope(admin, {}, null)).toEqual({
      role: UserRole.ADMIN,
      locationIds: null,
      channel: null,
    });
    expect(
      resolveAnalyticsScope(admin, { channel: SaleChannel.OFFLINE }, ['loc']),
    ).toEqual({
      role: UserRole.ADMIN,
      locationIds: ['loc'],
      channel: SaleChannel.OFFLINE,
    });
  });

  it('locks a store manager to their location subtree', () => {
    const scope = resolveAnalyticsScope(
      manager,
      { channel: SaleChannel.OFFLINE },
      ['store-1', 'display-1'],
    );
    expect(scope.locationIds).toEqual(['store-1', 'display-1']);
    expect(scope.channel).toBe(SaleChannel.OFFLINE);
  });

  it('forces the online channel for an online manager', () => {
    const scope = resolveAnalyticsScope(online, {}, null);
    expect(scope.channel).toBe(SaleChannel.ONLINE);
    expect(scope.locationIds).toBeNull();
    expect(() =>
      resolveAnalyticsScope(online, { channel: SaleChannel.OFFLINE }, null),
    ).toThrow(ForbiddenException);
  });
});

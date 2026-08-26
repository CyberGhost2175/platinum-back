import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../auth/types/auth.types';
import { UserRole } from '../common/enums/user-role.enum';
import { SaleChannel } from '../sales/enums/sale-channel.enum';

export interface AnalyticsScope {
  role: UserRole;
  /** null = all locations (admin / online manager). */
  locationIds: string[] | null;
  /** null = all channels. */
  channel: SaleChannel | null;
}

export interface AnalyticsScopeInput {
  locationId?: string;
  channel?: SaleChannel;
}

export function resolveAnalyticsScope(
  user: AuthUser,
  input: AnalyticsScopeInput,
  subtreeIds: string[] | null,
): AnalyticsScope {
  if (user.role === UserRole.ONLINE_MANAGER) {
    if (input.channel && input.channel !== SaleChannel.ONLINE) {
      throw new ForbiddenException('Online manager can only view the online channel');
    }
    return {
      role: user.role,
      locationIds: subtreeIds,
      channel: SaleChannel.ONLINE,
    };
  }

  if (user.role === UserRole.STORE_MANAGER) {
    if (!subtreeIds?.length) {
      throw new BadRequestException('Store manager must be assigned to a sales location');
    }
    return {
      role: user.role,
      locationIds: subtreeIds,
      channel: input.channel ?? null,
    };
  }

  if (user.role === UserRole.ADMIN) {
    return {
      role: user.role,
      locationIds: subtreeIds,
      channel: input.channel ?? null,
    };
  }

  throw new ForbiddenException('Analytics is not available for this role');
}

export function analyticsCacheKey(
  report: string,
  scope: AnalyticsScope,
  extra: Record<string, string | number | null | undefined>,
): string {
  const payload = JSON.stringify({
    report,
    locationIds: scope.locationIds,
    channel: scope.channel,
    ...extra,
  });
  return `analytics:v1:${report}:${hashString(payload)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

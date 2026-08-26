import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../auth/types/auth.types';
import { UserRole } from './enums/user-role.enum';

export function isLocationUnrestricted(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.WAREHOUSE;
}

export function resolveLocationScope(
  user: AuthUser,
  requested?: string | null,
): string | undefined {
  if (isLocationUnrestricted(user.role)) {
    return requested || undefined;
  }
  return requested || user.locationId || undefined;
}

export function assertLocationAccess(
  user: AuthUser,
  locationId: string,
): void {
  if (isLocationUnrestricted(user.role)) {
    return;
  }
  if (!user.locationId || user.locationId !== locationId) {
    throw new ForbiddenException('Access to this sales location is denied');
  }
}

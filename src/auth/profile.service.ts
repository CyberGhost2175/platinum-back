import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { Location } from '../locations/entities/location.entity';
import { LocationsService } from '../locations/locations.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../products/suppliers.service';
import { ShiftsService } from '../shifts/shifts.service';
import { UsersService } from '../users/users.service';
import { permissionsFor, ROLE_META } from './role-profile';

function locationCard(location: Location | null | undefined) {
  if (!location) {
    return null;
  }
  return {
    id: location.id,
    name: location.name,
    type: location.type,
    parentId: location.parentId,
  };
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersService,
    private readonly locations: LocationsService,
    private readonly shifts: ShiftsService,
    private readonly products: ProductsService,
    private readonly suppliers: SuppliersService,
  ) {}

  async build(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Authentication required');
    }

    const roleMeta = ROLE_META[user.role];
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      status: user.status,
      locationId: user.locationId,
      totpEnabled: user.totpEnabled,
      location: locationCard(user.location),
      roleMeta,
      permissions: permissionsFor(user.role),
      workspace: await this.workspace(user.role, user.id, user.locationId, user.location),
    };
  }

  private async workspace(
    role: UserRole,
    userId: string,
    locationId: string | null,
    location: Location | null,
  ) {
    const home = ROLE_META[role].nav[0]?.href ?? '/';
    const base = {
      home,
      location: locationCard(location),
    };

    if (role === UserRole.CASHIER) {
      const shift = await this.shifts.findOpenByCashier(userId);
      return {
        ...base,
        currentShift: shift
          ? {
              id: shift.id,
              status: shift.status,
              locationId: shift.locationId,
              openedAt: shift.openedAt,
            }
          : null,
      };
    }

    if (role === UserRole.STORE_MANAGER) {
      const subtree = locationId
        ? await this.locations.findSubtreeIds(locationId)
        : [];
      return {
        ...base,
        subtreeLocationIds: subtree,
      };
    }

    if (role === UserRole.WAREHOUSE) {
      let defaultWarehouse = null;
      try {
        defaultWarehouse = locationCard(
          await this.locations.findDefaultWarehouse(),
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
      return {
        ...base,
        defaultWarehouse,
      };
    }

    if (role === UserRole.ONLINE_MANAGER) {
      return {
        ...base,
        channel: 'online' as const,
      };
    }

    const [users, locations, suppliers, products] = await Promise.all([
      this.users.count(),
      this.locations.count(),
      this.suppliers.count(),
      this.products.count(),
    ]);
    return {
      ...base,
      counts: { users, locations, suppliers, products },
    };
  }
}

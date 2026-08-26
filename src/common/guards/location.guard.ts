import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_LOCATION_KEY } from '../decorators/require-location.decorator';
import { isLocationUnrestricted } from '../location-scope';
import { LocationsService } from '../../locations/locations.service';

@Injectable()
export class LocationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly locations: LocationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_LOCATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Location scope required');
    }
    if (isLocationUnrestricted(user.role)) {
      return true;
    }

    const requested = this.extractLocationId(request);
    if (!requested) {
      if (!user.locationId) {
        throw new ForbiddenException('Location scope required');
      }
      return true;
    }

    if (!(await this.locations.isAccessible(user, requested))) {
      throw new ForbiddenException('Access to this sales location is denied');
    }
    return true;
  }

  private extractLocationId(request: Request): string | undefined {
    const params = request.params?.locationId;
    if (typeof params === 'string' && params.length > 0) {
      return params;
    }
    const query = request.query?.locationId;
    if (typeof query === 'string' && query.length > 0) {
      return query;
    }
    const body = request.body as { locationId?: unknown } | undefined;
    if (body && typeof body.locationId === 'string' && body.locationId.length > 0) {
      return body.locationId;
    }
    return undefined;
  }
}

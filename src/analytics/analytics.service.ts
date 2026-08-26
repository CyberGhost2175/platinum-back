import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../auth/types/auth.types';
import { Env } from '../config/env.validation';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { LocationsService } from '../locations/locations.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsQueryService } from './analytics-query.service';
import {
  analyticsCacheKey,
  resolveAnalyticsScope,
} from './analytics-scope';
import { resolvePeriodRange } from './analytics-period';
import {
  AnalyticsGroupBy,
  AnalyticsMarginLevel,
  AnalyticsPeriod,
  AnalyticsReport,
} from './enums/analytics.enums';
import { SaleChannel } from '../sales/enums/sale-channel.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly queries: AnalyticsQueryService,
    private readonly locations: LocationsService,
    private readonly cache: RedisCacheService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async summary(user: AuthUser, query: AnalyticsQueryDto) {
    const revenue = await this.revenue(user, {
      ...query,
      period: query.period ?? AnalyticsPeriod.DAY,
    });
    return {
      scope: revenue.scope,
      period: revenue.period,
      ...revenue.totals,
    };
  }

  async revenue(user: AuthUser, query: AnalyticsQueryDto) {
    const { scope, range } = await this.prepare(user, query);
    return this.cached(
      analyticsCacheKey('revenue', scope, {
        from: range.fromDay,
        to: range.toDay,
        grain: range.grain,
      }),
      async () => ({
        scope,
        ...(await this.queries.revenueDashboard(scope, range)),
      }),
    );
  }

  async categories(user: AuthUser, query: AnalyticsQueryDto) {
    const { scope, range, limit } = await this.prepare(user, query);
    const groupBy = query.groupBy ?? AnalyticsGroupBy.ITEM_CATEGORY;
    return this.cached(
      analyticsCacheKey('categories', scope, {
        from: range.fromDay,
        to: range.toDay,
        groupBy,
        limit,
      }),
      async () => ({
        scope,
        period: range,
        ...(await this.queries.topCategories(scope, range, groupBy, limit)),
      }),
    );
  }

  async margin(user: AuthUser, query: AnalyticsQueryDto) {
    const { scope, range, limit } = await this.prepare(user, query);
    const level = query.level ?? AnalyticsMarginLevel.PRODUCT;
    return this.cached(
      analyticsCacheKey('margin', scope, {
        from: range.fromDay,
        to: range.toDay,
        level,
        limit,
      }),
      async () => ({
        scope,
        period: range,
        level,
        items:
          level === AnalyticsMarginLevel.RECEIPT
            ? await this.queries.marginByReceipt(scope, range, limit)
            : await this.queries.marginByProduct(scope, range, limit),
      }),
    );
  }

  async sellers(user: AuthUser, query: AnalyticsQueryDto) {
    const { scope, range, limit } = await this.prepare(user, query);
    return this.cached(
      analyticsCacheKey('sellers', scope, {
        from: range.fromDay,
        to: range.toDay,
        limit,
      }),
      async () => ({
        scope,
        period: range,
        items: await this.queries.sellerRanking(scope, range, limit),
      }),
    );
  }

  async inventory(user: AuthUser, query: AnalyticsQueryDto) {
    const { scope, range } = await this.prepare(user, query);
    const staleDays = this.config.get('STALE_ITEM_DAYS', { infer: true });
    return this.cached(
      analyticsCacheKey('inventory', scope, {
        from: range.fromDay,
        to: range.toDay,
        staleDays,
      }),
      async () => ({
        scope,
        period: range,
        ...(await this.queries.inventoryTurnover(scope, range, staleDays)),
      }),
    );
  }

  async report(user: AuthUser, report: AnalyticsReport, query: AnalyticsQueryDto) {
    switch (report) {
      case AnalyticsReport.REVENUE:
        return this.revenue(user, query);
      case AnalyticsReport.CATEGORIES:
        return this.categories(user, query);
      case AnalyticsReport.MARGIN:
        return this.margin(user, query);
      case AnalyticsReport.SELLERS:
        return this.sellers(user, query);
      case AnalyticsReport.INVENTORY:
        return this.inventory(user, query);
      default:
        throw new BadRequestException('Unknown analytics report');
    }
  }

  private async prepare(user: AuthUser, query: AnalyticsQueryDto) {
    const locationRoot = await this.resolveLocationRoot(user, query.locationId);
    const subtreeIds = locationRoot
      ? await this.locations.findSubtreeIds(locationRoot)
      : null;
    const scope = resolveAnalyticsScope(
      user,
      { locationId: query.locationId, channel: query.channel as SaleChannel | undefined },
      subtreeIds,
    );
    let range;
    try {
      range = resolvePeriodRange(
        query.period ?? AnalyticsPeriod.MONTH,
        query.from ? new Date(query.from) : undefined,
        query.to ? new Date(query.to) : undefined,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid period',
      );
    }
    return { scope, range, limit: query.limit ?? 20 };
  }

  private async resolveLocationRoot(
    user: AuthUser,
    requested?: string,
  ): Promise<string | null> {
    if (requested) {
      if (user.role === UserRole.STORE_MANAGER) {
        await this.locations.assertAccessible(user, requested);
      } else if (user.role === UserRole.ADMIN) {
        await this.locations.getOrFail(requested);
      } else if (user.role === UserRole.ONLINE_MANAGER) {
        await this.locations.getOrFail(requested);
      }
      return requested;
    }
    if (user.role === UserRole.STORE_MANAGER) {
      return user.locationId;
    }
    return null;
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit) {
      return hit;
    }
    const value = await factory();
    const ttl = this.config.get('ANALYTICS_CACHE_TTL_SECONDS', { infer: true });
    await this.cache.set(key, value, ttl);
    return value;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import { RedisCacheService } from '../common/redis/redis-cache.service';
import { AnalyticsConnection } from './analytics.connection';
import { AnalyticsScope } from './analytics-scope';
import { PeriodRange, dateTruncSql } from './analytics-period';
import { groupByColumnSql } from './analytics-sql';
import {
  AnalyticsGroupBy,
} from './enums/analytics.enums';
import { marginPercent } from './analytics-margin';

const MV_LOCK_KEY = 'analytics:mv:lock';
const MV_REFRESHED_KEY = 'analytics:mv:refreshedAt';

interface ScopeSql {
  sql: string;
  params: unknown[];
  next: number;
}

@Injectable()
export class AnalyticsQueryService {
  constructor(
    private readonly connection: AnalyticsConnection,
    private readonly cache: RedisCacheService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async ensureViewsFresh(): Promise<void> {
    const staleSeconds = this.config.get('ANALYTICS_MV_STALE_SECONDS', {
      infer: true,
    });
    const raw = await this.cache.getRaw(MV_REFRESHED_KEY);
    if (raw && Date.now() - Number(raw) < staleSeconds * 1000) {
      return;
    }
    const lock = await this.cache.setNx(MV_LOCK_KEY, '1', 30);
    if (!lock) {
      return;
    }
    try {
      try {
        await this.connection.write.query(
          `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_analytics_daily_sales`,
        );
        await this.connection.write.query(
          `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_analytics_daily_lines`,
        );
      } catch {
        await this.connection.write.query(
          `REFRESH MATERIALIZED VIEW mv_analytics_daily_sales`,
        );
        await this.connection.write.query(
          `REFRESH MATERIALIZED VIEW mv_analytics_daily_lines`,
        );
      }
      await this.cache.setRaw(MV_REFRESHED_KEY, String(Date.now()));
    } finally {
      await this.cache.del(MV_LOCK_KEY);
    }
  }

  async revenueDashboard(
    scope: AnalyticsScope,
    range: PeriodRange,
  ) {
    await this.ensureViewsFresh();
    const trunc = dateTruncSql(range.grain);
    const scoped = this.scopeFilter(scope, 3);
    const params = [range.fromDay, range.toDay, ...scoped.params];

    const [totals] = await this.connection.read.query<
      Array<{
        revenue_minor: string;
        receipts_count: string;
        items_qty: string;
      }>
    >(
      `
      SELECT
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor,
        COALESCE(SUM(mv.receipts_count), 0)::int AS receipts_count,
        COALESCE(SUM(mv.items_qty), 0)::int AS items_qty
      FROM mv_analytics_daily_sales mv
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      `,
      params,
    );

    const byBucket = await this.connection.read.query<
      Array<{
        bucket: string;
        revenue_minor: string;
        receipts_count: string;
        items_qty: string;
      }>
    >(
      `
      SELECT
        ${trunc} AS bucket,
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor,
        COALESCE(SUM(mv.receipts_count), 0)::int AS receipts_count,
        COALESCE(SUM(mv.items_qty), 0)::int AS items_qty
      FROM mv_analytics_daily_sales mv
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      GROUP BY 1
      ORDER BY 1
      `,
      params,
    );

    const byLocation = await this.connection.read.query<
      Array<{
        location_id: string;
        location_name: string;
        revenue_minor: string;
        receipts_count: string;
      }>
    >(
      `
      SELECT
        mv.location_id,
        loc.name AS location_name,
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor,
        COALESCE(SUM(mv.receipts_count), 0)::int AS receipts_count
      FROM mv_analytics_daily_sales mv
      INNER JOIN locations loc ON loc.id = mv.location_id
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      GROUP BY mv.location_id, loc.name
      ORDER BY SUM(mv.revenue_minor) DESC
      `,
      params,
    );

    const byChannel = await this.connection.read.query<
      Array<{
        channel: string;
        revenue_minor: string;
        receipts_count: string;
      }>
    >(
      `
      SELECT
        mv.channel,
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor,
        COALESCE(SUM(mv.receipts_count), 0)::int AS receipts_count
      FROM mv_analytics_daily_sales mv
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      GROUP BY mv.channel
      ORDER BY SUM(mv.revenue_minor) DESC
      `,
      params,
    );

    const revenueMinor = Number(totals?.revenue_minor ?? 0);
    const receiptsCount = Number(totals?.receipts_count ?? 0);
    return {
      period: range,
      totals: {
        revenueMinor,
        receiptsCount,
        itemsQty: Number(totals?.items_qty ?? 0),
        averageCheck:
          receiptsCount === 0 ? 0 : Math.round(revenueMinor / receiptsCount),
      },
      byBucket: byBucket.map((row) => ({
        bucket: row.bucket,
        revenueMinor: Number(row.revenue_minor),
        receiptsCount: Number(row.receipts_count),
        itemsQty: Number(row.items_qty),
      })),
      byLocation: byLocation.map((row) => ({
        locationId: row.location_id,
        locationName: row.location_name,
        revenueMinor: Number(row.revenue_minor),
        receiptsCount: Number(row.receipts_count),
      })),
      byChannel: byChannel.map((row) => ({
        channel: row.channel,
        revenueMinor: Number(row.revenue_minor),
        receiptsCount: Number(row.receipts_count),
      })),
    };
  }

  async topCategories(
    scope: AnalyticsScope,
    range: PeriodRange,
    groupBy: AnalyticsGroupBy,
    limit: number,
  ) {
    await this.ensureViewsFresh();
    const column = groupByColumnSql(groupBy);
    const scoped = this.scopeFilter(scope, 3);
    const rows = await this.connection.read.query<
      Array<{
        key: string;
        qty: string;
        revenue_minor: string;
      }>
    >(
      `
      SELECT
        ${column}::text AS key,
        COALESCE(SUM(mv.qty), 0)::int AS qty,
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor
      FROM mv_analytics_daily_lines mv
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      GROUP BY 1
      ORDER BY SUM(mv.revenue_minor) DESC
      LIMIT $${scoped.next}
      `,
      [range.fromDay, range.toDay, ...scoped.params, limit],
    );
    return {
      groupBy,
      items: rows.map((row) => ({
        key: row.key,
        qty: Number(row.qty),
        revenueMinor: Number(row.revenue_minor),
      })),
    };
  }

  async marginByProduct(
    scope: AnalyticsScope,
    range: PeriodRange,
    limit: number,
  ) {
    await this.ensureViewsFresh();
    const scoped = this.scopeFilter(scope, 3);
    const rows = await this.connection.read.query<
      Array<{
        product_id: string;
        sku: string;
        product_name: string;
        qty: string;
        revenue_minor: string;
        cost_minor: string;
        has_cost: boolean;
      }>
    >(
      `
      SELECT
        mv.product_id,
        mv.sku,
        mv.product_name,
        COALESCE(SUM(mv.qty), 0)::int AS qty,
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor,
        COALESCE(SUM(mv.cost_minor), 0)::bigint AS cost_minor,
        BOOL_OR(mv.has_cost) AS has_cost
      FROM mv_analytics_daily_lines mv
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      GROUP BY mv.product_id, mv.sku, mv.product_name
      ORDER BY SUM(mv.revenue_minor) DESC
      LIMIT $${scoped.next}
      `,
      [range.fromDay, range.toDay, ...scoped.params, limit],
    );
    return rows.map((row) => {
      const revenueMinor = Number(row.revenue_minor);
      const costMinor = Number(row.cost_minor);
      return {
        productId: row.product_id,
        sku: row.sku,
        name: row.product_name,
        qty: Number(row.qty),
        revenueMinor,
        costMinor,
        marginMinor: revenueMinor - costMinor,
        marginPercent: row.has_cost
          ? marginPercent(revenueMinor, costMinor)
          : null,
        hasCost: row.has_cost,
      };
    });
  }

  async marginByReceipt(
    scope: AnalyticsScope,
    range: PeriodRange,
    limit: number,
  ) {
    const scoped = this.saleScopeFilter(scope, 3);
    const rows = await this.connection.read.query<
      Array<{
        id: string;
        receipt_number: string | null;
        date: Date;
        revenue_minor: string;
        cost_minor: string;
        has_cost: boolean;
      }>
    >(
      `
      SELECT
        s.id,
        s.receipt_number,
        s.date,
        s.total_amount::bigint AS revenue_minor,
        COALESCE(SUM(si.qty * COALESCE(ROUND(p.cost_price * 100), 0)), 0)::bigint AS cost_minor,
        BOOL_OR(p.cost_price IS NOT NULL) AS has_cost
      FROM sales s
      INNER JOIN sale_items si ON si.sale_id = s.id
      INNER JOIN products p ON p.id = si.product_id
      WHERE s.status = 'paid'
        AND s.deleted_at IS NULL
        AND s.date >= $1::date
        AND s.date < ($2::date + interval '1 day')
        ${scoped.sql}
      GROUP BY s.id
      ORDER BY s.date DESC
      LIMIT $${scoped.next}
      `,
      [range.fromDay, range.toDay, ...scoped.params, limit],
    );
    return rows.map((row) => {
      const revenueMinor = Number(row.revenue_minor);
      const costMinor = Number(row.cost_minor);
      return {
        saleId: row.id,
        receiptNumber: row.receipt_number,
        date: row.date,
        revenueMinor,
        costMinor,
        marginMinor: revenueMinor - costMinor,
        marginPercent: row.has_cost
          ? marginPercent(revenueMinor, costMinor)
          : null,
        hasCost: row.has_cost,
      };
    });
  }

  async sellerRanking(scope: AnalyticsScope, range: PeriodRange, limit: number) {
    await this.ensureViewsFresh();
    const scoped = this.scopeFilter(scope, 3);
    const rows = await this.connection.read.query<
      Array<{
        seller_id: string;
        email: string;
        first_name: string;
        last_name: string;
        receipts_count: string;
        revenue_minor: string;
        items_qty: string;
      }>
    >(
      `
      SELECT
        mv.seller_id,
        u.email,
        u.first_name,
        u.last_name,
        COALESCE(SUM(mv.receipts_count), 0)::int AS receipts_count,
        COALESCE(SUM(mv.revenue_minor), 0)::bigint AS revenue_minor,
        COALESCE(SUM(mv.items_qty), 0)::int AS items_qty
      FROM mv_analytics_daily_sales mv
      INNER JOIN users u ON u.id = mv.seller_id
      WHERE mv.day BETWEEN $1 AND $2
      ${scoped.sql}
      GROUP BY mv.seller_id, u.email, u.first_name, u.last_name
      ORDER BY SUM(mv.revenue_minor) DESC, SUM(mv.receipts_count) DESC
      LIMIT $${scoped.next}
      `,
      [range.fromDay, range.toDay, ...scoped.params, limit],
    );
    return rows.map((row, index) => ({
      rank: index + 1,
      sellerId: row.seller_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      receiptsCount: Number(row.receipts_count),
      revenueMinor: Number(row.revenue_minor),
      itemsQty: Number(row.items_qty),
    }));
  }

  async inventoryTurnover(
    scope: AnalyticsScope,
    range: PeriodRange,
    staleDays: number,
  ) {
    await this.ensureViewsFresh();
    const locFilter = scope.locationIds
      ? 'AND item.location_id = ANY($1::uuid[])'
      : '';
    const soldFilter = scope.locationIds
      ? 'AND mv.location_id = ANY($3::uuid[])'
      : '';
    const channelFilter = scope.channel
      ? scope.locationIds
        ? 'AND mv.channel = $4'
        : 'AND mv.channel = $3'
      : '';
    const params: unknown[] = [range.fromDay, range.toDay];
    if (scope.locationIds) {
      params.push(scope.locationIds);
    }
    if (scope.channel) {
      params.push(scope.channel);
    }

    const stock = await this.connection.read.query<
      Array<{
        product_id: string;
        sku: string;
        name: string;
        available_qty: string;
        oldest_available: Date | null;
      }>
    >(
      `
      SELECT
        p.id AS product_id,
        p.sku,
        p.name,
        COUNT(item.id)::int AS available_qty,
        MIN(item.created_at) AS oldest_available
      FROM products p
      INNER JOIN items item
        ON item.product_id = p.id
       AND item.deleted_at IS NULL
       AND item.status IN ('in_stock', 'on_display')
       ${locFilter}
      GROUP BY p.id, p.sku, p.name
      `,
      scope.locationIds ? [scope.locationIds] : [],
    );

    const sold = await this.connection.read.query<
      Array<{ product_id: string; sku: string; product_name: string; qty: string }>
    >(
      `
      SELECT
        mv.product_id,
        MAX(mv.sku) AS sku,
        MAX(mv.product_name) AS product_name,
        COALESCE(SUM(mv.qty), 0)::int AS qty
      FROM mv_analytics_daily_lines mv
      WHERE mv.day BETWEEN $1 AND $2
      ${soldFilter}
      ${channelFilter}
      GROUP BY mv.product_id
      `,
      params,
    );

    const byId = new Map<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        availableQty: number;
        oldestAvailable: Date | null;
        soldQty: number;
      }
    >();
    for (const row of stock) {
      byId.set(row.product_id, {
        productId: row.product_id,
        sku: row.sku,
        name: row.name,
        availableQty: Number(row.available_qty),
        oldestAvailable: row.oldest_available,
        soldQty: 0,
      });
    }
    for (const row of sold) {
      const current = byId.get(row.product_id);
      if (current) {
        current.soldQty = Number(row.qty);
      } else {
        byId.set(row.product_id, {
          productId: row.product_id,
          sku: row.sku,
          name: row.product_name,
          availableQty: 0,
          oldestAvailable: null,
          soldQty: Number(row.qty),
        });
      }
    }
    const periodDays = Math.max(
      1,
      Math.round((range.to.getTime() - range.from.getTime()) / 86400000) || 1,
    );
    const staleMs = staleDays * 86400000;
    const now = Date.now();

    const items = [...byId.values()].map((row) => {
      const { availableQty, soldQty } = row;
      const stale =
        !!row.oldestAvailable &&
        now - new Date(row.oldestAvailable).getTime() >= staleMs &&
        availableQty > 0;
      const turnoverRate =
        availableQty + soldQty === 0
          ? 0
          : Math.round((soldQty / (availableQty + soldQty)) * 10000) / 100;
      const daysOfSupply =
        soldQty === 0
          ? availableQty > 0
            ? null
            : 0
          : Math.round((availableQty / (soldQty / periodDays)) * 10) / 10;
      return {
        productId: row.productId,
        sku: row.sku,
        name: row.name,
        availableQty,
        soldQty,
        turnoverRate,
        daysOfSupply,
        stale,
        illiquid: stale || (availableQty > 0 && soldQty === 0),
      };
    });

    const illiquid = items
      .filter((item) => item.illiquid)
      .sort((a, b) => b.availableQty - a.availableQty);

    return {
      periodDays,
      staleDays,
      totals: {
        skuCount: items.length,
        availableUnits: items.reduce((sum, item) => sum + item.availableQty, 0),
        soldUnits: items.reduce((sum, item) => sum + item.soldQty, 0),
        illiquidSkuCount: illiquid.length,
        staleSkuCount: items.filter((item) => item.stale).length,
      },
      illiquid: illiquid.slice(0, 100),
    };
  }

  private scopeFilter(scope: AnalyticsScope, startIndex: number): ScopeSql {
    const params: unknown[] = [];
    let sql = '';
    let index = startIndex;
    if (scope.locationIds) {
      params.push(scope.locationIds);
      sql += ` AND mv.location_id = ANY($${index}::uuid[])`;
      index += 1;
    }
    if (scope.channel) {
      params.push(scope.channel);
      sql += ` AND mv.channel = $${index}`;
      index += 1;
    }
    return { sql, params, next: index };
  }

  private saleScopeFilter(scope: AnalyticsScope, startIndex: number): ScopeSql {
    const params: unknown[] = [];
    let sql = '';
    let index = startIndex;
    if (scope.locationIds) {
      params.push(scope.locationIds);
      sql += ` AND s.location_id = ANY($${index}::uuid[])`;
      index += 1;
    }
    if (scope.channel) {
      params.push(scope.channel);
      sql += ` AND s.channel = $${index}`;
      index += 1;
    }
    return { sql, params, next: index };
  }
}

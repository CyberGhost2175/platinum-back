import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsModule20260825220000 implements MigrationInterface {
  name = 'AnalyticsModule20260825220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "cost_price" numeric(12,2)`,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_sales_analytics_paid_date"
      ON "sales" ("date", "location_id", "channel")
      WHERE "deleted_at" IS NULL AND "status" = 'paid'
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW "mv_analytics_daily_sales" AS
      SELECT
        ((s.date AT TIME ZONE 'UTC')::date) AS day,
        s.location_id,
        s.channel,
        s.seller_id,
        COUNT(*)::int AS receipts_count,
        COALESCE(SUM(s.total_amount), 0)::bigint AS revenue_minor,
        COALESCE(SUM(line.items_qty), 0)::int AS items_qty
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(qty)::int AS items_qty
        FROM sale_items
        GROUP BY sale_id
      ) line ON line.sale_id = s.id
      WHERE s.status = 'paid' AND s.deleted_at IS NULL
      GROUP BY 1, 2, 3, 4
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_mv_analytics_daily_sales"
      ON "mv_analytics_daily_sales" (day, location_id, channel, seller_id)
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW "mv_analytics_daily_lines" AS
      SELECT
        ((s.date AT TIME ZONE 'UTC')::date) AS day,
        s.location_id,
        s.channel,
        s.seller_id,
        si.product_id,
        p.sku,
        p.name AS product_name,
        p.item_category,
        p.metal_category,
        CASE
          WHEN si.price < 2000000 THEN 'budget'
          WHEN si.price < 8000000 THEN 'mid'
          ELSE 'premium'
        END AS price_segment,
        SUM(si.qty)::int AS qty,
        COALESCE(SUM(si.line_total), 0)::bigint AS revenue_minor,
        COALESCE(
          SUM(si.qty * COALESCE(ROUND(p.cost_price * 100), 0)),
          0
        )::bigint AS cost_minor,
        BOOL_OR(p.cost_price IS NOT NULL) AS has_cost
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN products p ON p.id = si.product_id
      WHERE s.status = 'paid' AND s.deleted_at IS NULL
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_mv_analytics_daily_lines"
      ON "mv_analytics_daily_lines"
      (day, location_id, channel, seller_id, product_id, price_segment)
    `);

    await queryRunner.query(`REFRESH MATERIALIZED VIEW "mv_analytics_daily_sales"`);
    await queryRunner.query(`REFRESH MATERIALIZED VIEW "mv_analytics_daily_lines"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_analytics_daily_lines"`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_analytics_daily_sales"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_analytics_paid_date"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "cost_price"`);
  }
}

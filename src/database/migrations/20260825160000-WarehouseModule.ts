import { MigrationInterface, QueryRunner } from 'typeorm';

export class WarehouseModule20260825160000 implements MigrationInterface {
  name = 'WarehouseModule20260825160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."item_status" ADD VALUE IF NOT EXISTS 'in_cleaning'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."item_status" ADD VALUE IF NOT EXISTS 'on_commission'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."item_audit_action" ADD VALUE IF NOT EXISTS 'sent_to_cleaning'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."item_audit_action" ADD VALUE IF NOT EXISTS 'returned_from_cleaning'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."item_audit_action" ADD VALUE IF NOT EXISTS 'sent_to_commission'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."item_audit_action" ADD VALUE IF NOT EXISTS 'returned_from_commission'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."stock_discrepancy_kind" AS ENUM('missing', 'extra')`,
    );

    await queryRunner.query(
      `ALTER TABLE "item_audit_logs" ADD "from_location_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_audit_logs" ADD "to_location_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" ADD "kind" "public"."stock_discrepancy_kind" NOT NULL DEFAULT 'missing'`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" ADD "unique_tag" character varying(64)`,
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_items_available_created_at"
      ON "items" ("created_at")
      WHERE "deleted_at" IS NULL
        AND "status" IN ('in_stock', 'on_display')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_items_available_created_at"`);
    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" DROP COLUMN "unique_tag"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" DROP COLUMN "kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_audit_logs" DROP COLUMN "to_location_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_audit_logs" DROP COLUMN "from_location_id"`,
    );
    await queryRunner.query(`DROP TYPE "public"."stock_discrepancy_kind"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfflineSales20260825180000 implements MigrationInterface {
  name = 'OfflineSales20260825180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."sale_status" AS ENUM('draft', 'paid', 'refunded')`,
    );

    await queryRunner.query(
      `ALTER TABLE "products" ADD "out_of_stock" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "receipt_number" DROP NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sales_receipt_number"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sales_receipt_number" ON "sales" ("receipt_number") WHERE "receipt_number" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "payment_method" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "total_amount" SET DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales" ADD "status" "public"."sale_status" NOT NULL DEFAULT 'paid'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD "promo_code" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD "discount_percent" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "sales" ADD "original_sale_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_status" ON "sales" ("status")`,
    );
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_original_sale_id"
      FOREIGN KEY ("original_sale_id") REFERENCES "sales"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `ALTER TABLE "sale_items" ADD "discount" bigint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" ADD "discount_percent" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" ADD "promo_code" character varying(64)`,
    );

    await queryRunner.query(`
      CREATE TABLE "receipt_sequences" (
        "location_id" uuid NOT NULL,
        "day" date NOT NULL,
        "last_value" integer NOT NULL,
        CONSTRAINT "PK_receipt_sequences" PRIMARY KEY ("location_id", "day")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shifts_one_open_per_cashier" ON "shifts" ("cashier_id") WHERE "status" = 'open'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_shifts_one_open_per_cashier"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "receipt_sequences"`);
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP COLUMN "promo_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP COLUMN "discount_percent"`,
    );
    await queryRunner.query(`ALTER TABLE "sale_items" DROP COLUMN "discount"`);
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_original_sale_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_status"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "original_sale_id"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "discount_percent"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "promo_code"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "status"`);
    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "payment_method" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sales_receipt_number"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sales_receipt_number" ON "sales" ("receipt_number")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "receipt_number" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "out_of_stock"`);
    await queryRunner.query(`DROP TYPE "public"."sale_status"`);
  }
}

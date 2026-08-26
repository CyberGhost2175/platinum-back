import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogSearch20260825200000 implements MigrationInterface {
  name = 'CatalogSearch20260825200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "name_tsv" tsvector
      GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name, ''))) STORED
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_products_name_tsv" ON "products" USING GIN ("name_tsv")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_sku_lower" ON "products" (lower("sku"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_price" ON "products" ("price") WHERE "price" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_out_of_stock" ON "products" ("out_of_stock")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_suppliers_name_trgm" ON "suppliers" USING GIN ("name" gin_trgm_ops)`,
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_items_product_available"
      ON "items" ("product_id", "location_id")
      WHERE "deleted_at" IS NULL
        AND "status" IN ('in_stock', 'on_display')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_items_product_available"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_suppliers_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_out_of_stock"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_price"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_sku_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_name_tsv"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "name_tsv"`,
    );
  }
}

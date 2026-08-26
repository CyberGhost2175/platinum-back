import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminDirectories20260825240000 implements MigrationInterface {
  name = 'AdminDirectories20260825240000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS product_sku_seq START WITH 1 INCREMENT BY 1
    `);
    const [{ max }] = (await queryRunner.query(`
      SELECT COALESCE(MAX(
        CASE WHEN sku ~ '^PT-[0-9]{6}$'
          THEN CAST(SUBSTRING(sku FROM 4) AS int)
          ELSE 0
        END
      ), 0) AS max
      FROM products
    `)) as Array<{ max: string | number }>;
    const start = Number(max) + 1;
    await queryRunner.query(`SELECT setval('product_sku_seq', $1, false)`, [
      Math.max(start, 1),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS product_sku_seq`);
  }
}

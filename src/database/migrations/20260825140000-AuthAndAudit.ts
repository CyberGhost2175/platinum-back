import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthAndAudit20260825140000 implements MigrationInterface {
  name = 'AuthAndAudit20260825140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "totp_secret" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "totp_enabled" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "role" character varying(32),
        "action" character varying NOT NULL,
        "resource" character varying NOT NULL,
        "entity_id" character varying,
        "method" character varying NOT NULL,
        "path" character varying NOT NULL,
        "request_id" character varying,
        "payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_resource_created_at" ON "audit_logs" ("resource", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "FK_audit_logs_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_enabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_secret"`);
  }
}

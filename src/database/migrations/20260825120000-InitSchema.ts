import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema20260825120000 implements MigrationInterface {
  name = 'InitSchema20260825120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Replace tables created by the former synchronize:true skeleton.
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_check_discrepancies" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_checks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shifts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "item_audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "batches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."order_status" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."shift_status" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sale_channel" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payment_method" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."user_status" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."user_role" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."location_type" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."item_audit_action" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."item_status" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."item_category" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."gold_tone" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."metal_category" CASCADE`);

    await queryRunner.query(
      `CREATE TYPE "public"."metal_category" AS ENUM('gold', 'silver', 'diamonds')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."gold_tone" AS ENUM('red', 'yellow', 'white')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."item_category" AS ENUM('rings', 'earrings', 'studs', 'necklaces', 'bracelets', 'chains')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."item_status" AS ENUM('in_stock', 'on_display', 'sold', 'in_repair')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."item_audit_action" AS ENUM('created', 'status_changed', 'moved', 'sold', 'returned', 'sent_to_repair', 'returned_from_repair', 'soft_deleted', 'restored')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."location_type" AS ENUM('warehouse', 'store', 'display')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('admin', 'store_manager', 'cashier', 'online_manager', 'warehouse')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('active', 'blocked')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sale_channel" AS ENUM('offline', 'online')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shift_status" AS ENUM('open', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'assembled', 'shipped', 'delivered', 'cancelled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "phone" character varying,
        "email" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suppliers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_suppliers_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."location_type" NOT NULL,
        "name" character varying NOT NULL,
        "parent_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_locations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_locations_parent_id" ON "locations" ("parent_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_locations_type" ON "locations" ("type")`,
    );
    await queryRunner.query(`
      ALTER TABLE "locations"
      ADD CONSTRAINT "FK_locations_parent_id"
      FOREIGN KEY ("parent_id") REFERENCES "locations"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role" "public"."user_role" NOT NULL,
        "status" "public"."user_status" NOT NULL DEFAULT 'active',
        "email" character varying NOT NULL,
        "phone" character varying(32),
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "location_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_location_id" ON "users" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_role" ON "users" ("role")`,
    );
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_location_id"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "full_name" character varying NOT NULL,
        "phone" character varying(32),
        "email" character varying(255),
        "loyalty_points" integer NOT NULL DEFAULT 0,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_phone" ON "customers" ("phone")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_email" ON "customers" ("email")`,
    );

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sku" character varying(64) NOT NULL,
        "name" character varying NOT NULL,
        "weight" numeric(10,3) NOT NULL,
        "metal_category" "public"."metal_category" NOT NULL,
        "gold_tone" "public"."gold_tone",
        "item_category" "public"."item_category" NOT NULL,
        "supplier_id" uuid NOT NULL,
        "price" numeric(12,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_products_gold_tone"
          CHECK ("gold_tone" IS NULL OR "metal_category" = 'gold')
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_products_sku" ON "products" ("sku")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_supplier_id" ON "products" ("supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_metal_category_item_category" ON "products" ("metal_category", "item_category")`,
    );
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD CONSTRAINT "FK_products_supplier_id"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "supplier_id" uuid NOT NULL,
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "documents" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_batches_supplier_id" ON "batches" ("supplier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_batches_received_at" ON "batches" ("received_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "batches"
      ADD CONSTRAINT "FK_batches_supplier_id"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "unique_tag" character varying(64) NOT NULL,
        "product_id" uuid NOT NULL,
        "location_id" uuid NOT NULL,
        "batch_id" uuid,
        "status" "public"."item_status" NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_items_unique_tag" ON "items" ("unique_tag")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_items_product_id" ON "items" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_items_location_id" ON "items" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_items_batch_id" ON "items" ("batch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_items_status" ON "items" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_items_product_id_status" ON "items" ("product_id", "status")`,
    );
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_product_id"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_location_id"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "items"
      ADD CONSTRAINT "FK_items_batch_id"
      FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "item_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "action" "public"."item_audit_action" NOT NULL,
        "from_status" "public"."item_status",
        "to_status" "public"."item_status",
        "payload" jsonb,
        "actor_user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_item_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_item_audit_logs_item_id" ON "item_audit_logs" ("item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_item_audit_logs_item_id_created_at" ON "item_audit_logs" ("item_id", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "item_audit_logs"
      ADD CONSTRAINT "FK_item_audit_logs_item_id"
      FOREIGN KEY ("item_id") REFERENCES "items"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "item_audit_logs"
      ADD CONSTRAINT "FK_item_audit_logs_actor_user_id"
      FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "shifts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cashier_id" uuid NOT NULL,
        "location_id" uuid NOT NULL,
        "status" "public"."shift_status" NOT NULL DEFAULT 'open',
        "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "closed_at" TIMESTAMP WITH TIME ZONE,
        "cash_total" bigint NOT NULL DEFAULT 0,
        "card_total" bigint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shifts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_shifts_cashier_id_status" ON "shifts" ("cashier_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shifts_location_id" ON "shifts" ("location_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "shifts"
      ADD CONSTRAINT "FK_shifts_cashier_id"
      FOREIGN KEY ("cashier_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "shifts"
      ADD CONSTRAINT "FK_shifts_location_id"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "sales" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "receipt_number" character varying(64) NOT NULL,
        "location_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "shift_id" uuid,
        "customer_id" uuid,
        "payment_method" "public"."payment_method" NOT NULL,
        "channel" "public"."sale_channel" NOT NULL,
        "discount" bigint NOT NULL DEFAULT 0,
        "total_amount" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_sales" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sales_receipt_number" ON "sales" ("receipt_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_shift_id" ON "sales" ("shift_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_location_id" ON "sales" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_seller_id" ON "sales" ("seller_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_customer_id" ON "sales" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sales_channel_date" ON "sales" ("channel", "date")`,
    );
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_location_id"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_seller_id"
      FOREIGN KEY ("seller_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_shift_id"
      FOREIGN KEY ("shift_id") REFERENCES "shifts"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "sale_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sale_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "item_id" uuid,
        "qty" integer NOT NULL DEFAULT 1,
        "price" bigint NOT NULL,
        "line_total" bigint NOT NULL,
        CONSTRAINT "PK_sale_items" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_sale_items_qty_positive" CHECK ("qty" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sale_items_sale_id" ON "sale_items" ("sale_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sale_items_product_id" ON "sale_items" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sale_items_item_id" ON "sale_items" ("item_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "sale_items"
      ADD CONSTRAINT "FK_sale_items_sale_id"
      FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sale_items"
      ADD CONSTRAINT "FK_sale_items_product_id"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sale_items"
      ADD CONSTRAINT "FK_sale_items_item_id"
      FOREIGN KEY ("item_id") REFERENCES "items"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "status" "public"."order_status" NOT NULL DEFAULT 'new',
        "total_amount" bigint NOT NULL DEFAULT 0,
        "delivery_info" jsonb,
        "payment_info" jsonb,
        "comment" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_customer_id" ON "orders" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_status_created_at" ON "orders" ("status", "created_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "FK_orders_customer_id"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "item_id" uuid,
        "qty" integer NOT NULL DEFAULT 1,
        "price" bigint NOT NULL,
        "line_total" bigint NOT NULL,
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_items_qty_positive" CHECK ("qty" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_product_id" ON "order_items" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_item_id" ON "order_items" ("item_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD CONSTRAINT "FK_order_items_order_id"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD CONSTRAINT "FK_order_items_product_id"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD CONSTRAINT "FK_order_items_item_id"
      FOREIGN KEY ("item_id") REFERENCES "items"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_checks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "location_id" uuid NOT NULL,
        "responsible_user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_checks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_checks_location_id" ON "stock_checks" ("location_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_checks_date" ON "stock_checks" ("date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_checks_responsible_user_id" ON "stock_checks" ("responsible_user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "stock_checks"
      ADD CONSTRAINT "FK_stock_checks_location_id"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_checks"
      ADD CONSTRAINT "FK_stock_checks_responsible_user_id"
      FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_check_discrepancies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "stock_check_id" uuid NOT NULL,
        "item_id" uuid,
        "product_id" uuid,
        "expected_qty" integer NOT NULL,
        "actual_qty" integer NOT NULL,
        "note" text,
        CONSTRAINT "PK_stock_check_discrepancies" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_check_discrepancies_stock_check_id" ON "stock_check_discrepancies" ("stock_check_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_check_discrepancies_item_id" ON "stock_check_discrepancies" ("item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_check_discrepancies_product_id" ON "stock_check_discrepancies" ("product_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "stock_check_discrepancies"
      ADD CONSTRAINT "FK_stock_check_discrepancies_stock_check_id"
      FOREIGN KEY ("stock_check_id") REFERENCES "stock_checks"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_check_discrepancies"
      ADD CONSTRAINT "FK_stock_check_discrepancies_item_id"
      FOREIGN KEY ("item_id") REFERENCES "items"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_check_discrepancies"
      ADD CONSTRAINT "FK_stock_check_discrepancies_product_id"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" DROP CONSTRAINT "FK_stock_check_discrepancies_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" DROP CONSTRAINT "FK_stock_check_discrepancies_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_check_discrepancies" DROP CONSTRAINT "FK_stock_check_discrepancies_stock_check_id"`,
    );
    await queryRunner.query(`DROP TABLE "stock_check_discrepancies"`);

    await queryRunner.query(
      `ALTER TABLE "stock_checks" DROP CONSTRAINT "FK_stock_checks_responsible_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_checks" DROP CONSTRAINT "FK_stock_checks_location_id"`,
    );
    await queryRunner.query(`DROP TABLE "stock_checks"`);

    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_order_id"`,
    );
    await queryRunner.query(`DROP TABLE "order_items"`);

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_customer_id"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);

    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP CONSTRAINT "FK_sale_items_item_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP CONSTRAINT "FK_sale_items_product_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_items" DROP CONSTRAINT "FK_sale_items_sale_id"`,
    );
    await queryRunner.query(`DROP TABLE "sale_items"`);

    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_shift_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_seller_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT "FK_sales_location_id"`,
    );
    await queryRunner.query(`DROP TABLE "sales"`);

    await queryRunner.query(
      `ALTER TABLE "shifts" DROP CONSTRAINT "FK_shifts_location_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" DROP CONSTRAINT "FK_shifts_cashier_id"`,
    );
    await queryRunner.query(`DROP TABLE "shifts"`);

    await queryRunner.query(
      `ALTER TABLE "item_audit_logs" DROP CONSTRAINT "FK_item_audit_logs_actor_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_audit_logs" DROP CONSTRAINT "FK_item_audit_logs_item_id"`,
    );
    await queryRunner.query(`DROP TABLE "item_audit_logs"`);

    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_batch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_location_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_product_id"`,
    );
    await queryRunner.query(`DROP TABLE "items"`);

    await queryRunner.query(
      `ALTER TABLE "batches" DROP CONSTRAINT "FK_batches_supplier_id"`,
    );
    await queryRunner.query(`DROP TABLE "batches"`);

    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_products_supplier_id"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);

    await queryRunner.query(`DROP TABLE "customers"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_location_id"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT "FK_locations_parent_id"`,
    );
    await queryRunner.query(`DROP TABLE "locations"`);

    await queryRunner.query(`DROP TABLE "suppliers"`);

    await queryRunner.query(`DROP TYPE "public"."order_status"`);
    await queryRunner.query(`DROP TYPE "public"."shift_status"`);
    await queryRunner.query(`DROP TYPE "public"."sale_channel"`);
    await queryRunner.query(`DROP TYPE "public"."payment_method"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`DROP TYPE "public"."location_type"`);
    await queryRunner.query(`DROP TYPE "public"."item_audit_action"`);
    await queryRunner.query(`DROP TYPE "public"."item_status"`);
    await queryRunner.query(`DROP TYPE "public"."item_category"`);
    await queryRunner.query(`DROP TYPE "public"."gold_tone"`);
    await queryRunner.query(`DROP TYPE "public"."metal_category"`);
  }
}

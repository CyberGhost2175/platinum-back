import 'dotenv/config';
import { hash } from 'bcryptjs';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import dataSource from './data-source';
import { User } from '../users/entities/user.entity';

/** Stable IDs from the old demo seed — used only to wipe leftover mock rows. */
const IDS = {
  supplierYuv: '11111111-1111-4111-8111-111111111111',
  supplierAlmaz: '11111111-1111-4111-8111-111111111112',
  supplierSilver: '11111111-1111-4111-8111-111111111113',
  warehouse: '22222222-2222-4222-8222-222222222221',
  store: '22222222-2222-4222-8222-222222222222',
  display: '22222222-2222-4222-8222-222222222223',
  admin: '33333333-3333-4333-8333-333333333331',
  cashier: '33333333-3333-4333-8333-333333333332',
  manager: '33333333-3333-4333-8333-333333333333',
  warehouseUser: '33333333-3333-4333-8333-333333333334',
  onlineUser: '33333333-3333-4333-8333-333333333335',
  productRing: '44444444-4444-4444-8444-444444444441',
  productEarrings: '44444444-4444-4444-8444-444444444442',
  productStuds: '44444444-4444-4444-8444-444444444443',
  productChain: '44444444-4444-4444-8444-444444444444',
  batch: '55555555-5555-4555-8555-555555555551',
  itemRing1: '66666666-6666-4666-8666-666666666661',
  itemRing2: '66666666-6666-4666-8666-666666666662',
  itemEarrings: '66666666-6666-4666-8666-666666666663',
  itemStuds: '66666666-6666-4666-8666-666666666664',
  itemChain: '66666666-6666-4666-8666-666666666665',
  customer: '77777777-7777-4777-8777-777777777771',
} as const;

const SEED_LOCATION_IDS = [IDS.warehouse, IDS.store, IDS.display];
const SEED_PRODUCT_IDS = [
  IDS.productRing,
  IDS.productEarrings,
  IDS.productStuds,
  IDS.productChain,
];
const SEED_ITEM_IDS = [
  IDS.itemRing1,
  IDS.itemRing2,
  IDS.itemEarrings,
  IDS.itemStuds,
  IDS.itemChain,
];
const SEED_SUPPLIER_IDS = [
  IDS.supplierYuv,
  IDS.supplierAlmaz,
  IDS.supplierSilver,
];
const SEED_DEMO_USER_IDS = [
  IDS.cashier,
  IDS.manager,
  IDS.warehouseUser,
  IDS.onlineUser,
];
const SEED_DEMO_EMAILS = [
  'cashier@example.com',
  'manager@example.com',
  'warehouse@example.com',
  'online@example.com',
];

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin1234';

async function wipeMockData(): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const q = (sql: string, params: unknown[] = []) =>
      manager.query(sql, params);

    const doomedSales = (await q(
      `
      SELECT id FROM sales
      WHERE location_id = ANY($1::uuid[])
         OR seller_id = ANY($2::uuid[])
         OR customer_id = $3
         OR id IN (
           SELECT sale_id FROM sale_items
           WHERE product_id = ANY($4::uuid[])
              OR item_id = ANY($5::uuid[])
         )
      `,
      [
        SEED_LOCATION_IDS,
        SEED_DEMO_USER_IDS,
        IDS.customer,
        SEED_PRODUCT_IDS,
        SEED_ITEM_IDS,
      ],
    )) as Array<{ id: string }>;
    const doomedSaleIds = doomedSales.map((row) => row.id);

    if (doomedSaleIds.length > 0) {
      await q(`DELETE FROM sale_items WHERE sale_id = ANY($1::uuid[])`, [
        doomedSaleIds,
      ]);
      await q(
        `
        UPDATE sales SET original_sale_id = NULL
        WHERE original_sale_id = ANY($1::uuid[])
        `,
        [doomedSaleIds],
      );
      await q(`DELETE FROM sales WHERE id = ANY($1::uuid[])`, [doomedSaleIds]);
    }

    await q(
      `
      DELETE FROM sale_items
      WHERE product_id = ANY($1::uuid[])
         OR item_id = ANY($2::uuid[])
      `,
      [SEED_PRODUCT_IDS, SEED_ITEM_IDS],
    );

    const doomedOrders = (await q(
      `
      SELECT id FROM orders
      WHERE customer_id = $1
         OR id IN (
           SELECT order_id FROM order_items
           WHERE product_id = ANY($2::uuid[])
              OR item_id = ANY($3::uuid[])
         )
      `,
      [IDS.customer, SEED_PRODUCT_IDS, SEED_ITEM_IDS],
    )) as Array<{ id: string }>;
    const doomedOrderIds = doomedOrders.map((row) => row.id);
    if (doomedOrderIds.length > 0) {
      await q(`DELETE FROM order_items WHERE order_id = ANY($1::uuid[])`, [
        doomedOrderIds,
      ]);
      await q(`DELETE FROM orders WHERE id = ANY($1::uuid[])`, [doomedOrderIds]);
    }

    await q(
      `
      DELETE FROM stock_check_discrepancies
      WHERE item_id = ANY($1::uuid[])
         OR product_id = ANY($2::uuid[])
         OR stock_check_id IN (
           SELECT id FROM stock_checks
           WHERE location_id = ANY($3::uuid[])
              OR responsible_user_id = ANY($4::uuid[])
         )
      `,
      [SEED_ITEM_IDS, SEED_PRODUCT_IDS, SEED_LOCATION_IDS, SEED_DEMO_USER_IDS],
    );
    await q(
      `
      DELETE FROM stock_checks
      WHERE location_id = ANY($1::uuid[])
         OR responsible_user_id = ANY($2::uuid[])
      `,
      [SEED_LOCATION_IDS, SEED_DEMO_USER_IDS],
    );

    await q(
      `
      DELETE FROM shifts
      WHERE location_id = ANY($1::uuid[])
         OR cashier_id = ANY($2::uuid[])
      `,
      [SEED_LOCATION_IDS, SEED_DEMO_USER_IDS],
    );

    await q(`DELETE FROM item_audit_logs WHERE item_id = ANY($1::uuid[])`, [
      SEED_ITEM_IDS,
    ]);
    await q(`DELETE FROM items WHERE id = ANY($1::uuid[])`, [SEED_ITEM_IDS]);

    await q(
      `
      DELETE FROM sale_items
      WHERE item_id IN (SELECT id FROM items WHERE location_id = ANY($1::uuid[]))
      `,
      [SEED_LOCATION_IDS],
    );
    await q(
      `
      DELETE FROM order_items
      WHERE item_id IN (SELECT id FROM items WHERE location_id = ANY($1::uuid[]))
      `,
      [SEED_LOCATION_IDS],
    );
    await q(
      `
      DELETE FROM stock_check_discrepancies
      WHERE item_id IN (SELECT id FROM items WHERE location_id = ANY($1::uuid[]))
      `,
      [SEED_LOCATION_IDS],
    );
    await q(
      `
      DELETE FROM item_audit_logs
      WHERE item_id IN (SELECT id FROM items WHERE location_id = ANY($1::uuid[]))
      `,
      [SEED_LOCATION_IDS],
    );
    await q(`DELETE FROM items WHERE location_id = ANY($1::uuid[])`, [
      SEED_LOCATION_IDS,
    ]);
    await q(
      `UPDATE items SET batch_id = NULL WHERE batch_id = $1 OR batch_id IN (
         SELECT id FROM batches WHERE supplier_id = ANY($2::uuid[])
       )`,
      [IDS.batch, SEED_SUPPLIER_IDS],
    );
    await q(
      `DELETE FROM batches WHERE id = $1 OR supplier_id = ANY($2::uuid[])`,
      [IDS.batch, SEED_SUPPLIER_IDS],
    );
    await q(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [
      SEED_PRODUCT_IDS,
    ]);
    await q(`DELETE FROM customers WHERE id = $1`, [IDS.customer]);

    await q(`DELETE FROM receipt_sequences WHERE location_id = ANY($1::uuid[])`, [
      SEED_LOCATION_IDS,
    ]);

    await q(
      `UPDATE users SET location_id = NULL WHERE location_id = ANY($1::uuid[])`,
      [SEED_LOCATION_IDS],
    );
    await q(
      `UPDATE locations SET parent_id = NULL WHERE parent_id = ANY($1::uuid[])`,
      [SEED_LOCATION_IDS],
    );

    await q(
      `DELETE FROM users WHERE id = ANY($1::uuid[]) OR email = ANY($2::text[])`,
      [SEED_DEMO_USER_IDS, SEED_DEMO_EMAILS],
    );

    await q(`DELETE FROM locations WHERE id = $1`, [IDS.display]);
    await q(`DELETE FROM locations WHERE id = $1`, [IDS.store]);
    await q(`DELETE FROM locations WHERE id = $1`, [IDS.warehouse]);

    await q(
      `
      DELETE FROM suppliers
      WHERE id = ANY($1::uuid[])
        AND NOT EXISTS (
          SELECT 1 FROM products WHERE products.supplier_id = suppliers.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM batches WHERE batches.supplier_id = suppliers.id
        )
      `,
      [SEED_SUPPLIER_IDS],
    );
  });
}

async function ensureAdmin(): Promise<void> {
  const users = dataSource.getRepository(User);
  const existing = await users.findOne({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    return;
  }

  await users.save({
    id: IDS.admin,
    email: ADMIN_EMAIL,
    phone: null,
    firstName: 'Admin',
    lastName: 'Admin',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    locationId: null,
    passwordHash: await hash(ADMIN_PASSWORD, 10),
    totpEnabled: false,
  });
}

async function seed(): Promise<void> {
  await dataSource.initialize();
  await wipeMockData();
  await ensureAdmin();
  console.log('Mock catalog, locations, and demo users removed.');
  console.log(`Bootstrap login (if created): ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

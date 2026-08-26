import 'dotenv/config';
import { hash } from 'bcryptjs';
import { UserRole } from '../common/enums/user-role.enum';
import { ItemAuditAction } from '../inventory/enums/item-audit-action.enum';
import { ItemStatus } from '../inventory/enums/item-status.enum';
import { LocationType } from '../locations/enums/location-type.enum';
import { GoldTone } from '../products/enums/gold-tone.enum';
import { ItemCategory } from '../products/enums/item-category.enum';
import { MetalCategory } from '../products/enums/metal-category.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import dataSource from './data-source';
import { Supplier } from '../products/entities/supplier.entity';
import { Location } from '../locations/entities/location.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { Batch } from '../inventory/entities/batch.entity';
import { Item } from '../inventory/entities/item.entity';
import { ItemAuditLog } from '../inventory/entities/item-audit-log.entity';
import { Customer } from '../customers/entities/customer.entity';

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

async function seed(): Promise<void> {
  await dataSource.initialize();

  const suppliers = dataSource.getRepository(Supplier);
  const locations = dataSource.getRepository(Location);
  const users = dataSource.getRepository(User);
  const products = dataSource.getRepository(Product);
  const batches = dataSource.getRepository(Batch);
  const items = dataSource.getRepository(Item);
  const history = dataSource.getRepository(ItemAuditLog);
  const customers = dataSource.getRepository(Customer);

  await suppliers.save([
    {
      id: IDS.supplierYuv,
      name: 'Ювелирторг',
      phone: '+74951234567',
      email: 'sales@juvelirtorg.example',
      isActive: true,
    },
    {
      id: IDS.supplierAlmaz,
      name: 'Алмаз-Холдинг',
      phone: '+74957654321',
      email: 'opt@almaz.example',
      isActive: true,
    },
    {
      id: IDS.supplierSilver,
      name: 'Серебряный век',
      phone: '+78121230000',
      email: 'hello@silverage.example',
      isActive: true,
    },
  ]);

  await locations.save({
    id: IDS.warehouse,
    type: LocationType.WAREHOUSE,
    name: 'Главный склад',
    parentId: null,
  });
  await locations.save({
    id: IDS.store,
    type: LocationType.STORE,
    name: 'Салон на Тверской',
    parentId: IDS.warehouse,
  });
  await locations.save({
    id: IDS.display,
    type: LocationType.DISPLAY,
    name: 'Витрина зала 1',
    parentId: IDS.store,
  });

  const passwordHash = await hash('admin1234', 10);
  const cashierHash = await hash('cashier12', 10);
  const managerHash = await hash('manager12', 10);
  const warehouseHash = await hash('warehouse12', 10);
  const onlineHash = await hash('online1234', 10);
  await users.save([
    {
      id: IDS.admin,
      email: 'admin@example.com',
      phone: '+79001112233',
      firstName: 'Local',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      locationId: IDS.store,
      passwordHash,
      totpEnabled: false,
    },
    {
      id: IDS.cashier,
      email: 'cashier@example.com',
      phone: '+79001112234',
      firstName: 'Anna',
      lastName: 'Cashier',
      role: UserRole.CASHIER,
      status: UserStatus.ACTIVE,
      locationId: IDS.store,
      passwordHash: cashierHash,
      totpEnabled: false,
    },
    {
      id: IDS.manager,
      email: 'manager@example.com',
      phone: '+79001112235',
      firstName: 'Ivan',
      lastName: 'Manager',
      role: UserRole.STORE_MANAGER,
      status: UserStatus.ACTIVE,
      locationId: IDS.store,
      passwordHash: managerHash,
      totpEnabled: false,
    },
    {
      id: IDS.warehouseUser,
      email: 'warehouse@example.com',
      phone: '+79001112236',
      firstName: 'Petr',
      lastName: 'Skladov',
      role: UserRole.WAREHOUSE,
      status: UserStatus.ACTIVE,
      locationId: IDS.warehouse,
      passwordHash: warehouseHash,
      totpEnabled: false,
    },
    {
      id: IDS.onlineUser,
      email: 'online@example.com',
      phone: '+79001112237',
      firstName: 'Elena',
      lastName: 'Online',
      role: UserRole.ONLINE_MANAGER,
      status: UserStatus.ACTIVE,
      locationId: null,
      passwordHash: onlineHash,
      totpEnabled: false,
    },
  ]);

  await products.save([
    {
      id: IDS.productRing,
      sku: '2000000000001',
      name: 'Кольцо 585 красное золото',
      weight: '2.350',
      metalCategory: MetalCategory.GOLD,
      goldTone: GoldTone.RED,
      itemCategory: ItemCategory.RINGS,
      supplierId: IDS.supplierYuv,
      price: '45990.00',
      costPrice: '22100.00',
    },
    {
      id: IDS.productEarrings,
      sku: '2000000000002',
      name: 'Серьги серебро 925',
      weight: '4.120',
      metalCategory: MetalCategory.SILVER,
      goldTone: null,
      itemCategory: ItemCategory.EARRINGS,
      supplierId: IDS.supplierSilver,
      price: '8900.00',
      costPrice: '4100.00',
    },
    {
      id: IDS.productStuds,
      sku: '2000000000003',
      name: 'Пусеты с бриллиантами',
      weight: '1.050',
      metalCategory: MetalCategory.DIAMONDS,
      goldTone: null,
      itemCategory: ItemCategory.STUDS,
      supplierId: IDS.supplierAlmaz,
      price: '125000.00',
      costPrice: '78000.00',
    },
    {
      id: IDS.productChain,
      sku: '2000000000004',
      name: 'Цепь белое золото 585',
      weight: '8.400',
      metalCategory: MetalCategory.GOLD,
      goldTone: GoldTone.WHITE,
      itemCategory: ItemCategory.CHAINS,
      supplierId: IDS.supplierYuv,
      price: '67200.00',
      costPrice: '31800.00',
    },
  ]);

  await batches.save({
    id: IDS.batch,
    supplierId: IDS.supplierYuv,
    receivedAt: new Date('2026-08-01T09:00:00.000Z'),
    documents: [
      {
        name: 'upd-2026-08-01.pdf',
        mimeType: 'application/pdf',
        uploadedAt: '2026-08-01T09:05:00.000Z',
      },
    ],
  });

  const seededItems: Array<{
    id: string;
    uniqueTag: string;
    productId: string;
    locationId: string;
    status: ItemStatus;
    batchId: string | null;
  }> = [
    {
      id: IDS.itemRing1,
      uniqueTag: 'TAG-000001',
      productId: IDS.productRing,
      locationId: IDS.warehouse,
      status: ItemStatus.IN_STOCK,
      batchId: IDS.batch,
    },
    {
      id: IDS.itemRing2,
      uniqueTag: 'TAG-000002',
      productId: IDS.productRing,
      locationId: IDS.display,
      status: ItemStatus.ON_DISPLAY,
      batchId: IDS.batch,
    },
    {
      id: IDS.itemEarrings,
      uniqueTag: 'TAG-000003',
      productId: IDS.productEarrings,
      locationId: IDS.store,
      status: ItemStatus.IN_STOCK,
      batchId: null,
    },
    {
      id: IDS.itemStuds,
      uniqueTag: 'TAG-000004',
      productId: IDS.productStuds,
      locationId: IDS.display,
      status: ItemStatus.ON_DISPLAY,
      batchId: null,
    },
    {
      id: IDS.itemChain,
      uniqueTag: 'TAG-000005',
      productId: IDS.productChain,
      locationId: IDS.warehouse,
      status: ItemStatus.IN_STOCK,
      batchId: IDS.batch,
    },
  ];

  await items.save(seededItems);

  const existingLogs = await history.count();
  if (existingLogs === 0) {
    await history.save(
      seededItems.map((item) =>
        history.create({
          itemId: item.id,
          action: ItemAuditAction.CREATED,
          fromStatus: null,
          toStatus: item.status,
          payload: { uniqueTag: item.uniqueTag, locationId: item.locationId },
          actorUserId: IDS.admin,
        }),
      ),
    );
  }

  await customers.save({
    id: IDS.customer,
    fullName: 'Анна Сергеева',
    phone: '+79005550101',
    email: 'anna.sergeeva@example.com',
    loyaltyPoints: 120,
    notes: 'Постоянный клиент салона на Тверской',
  });

  console.log('Seed completed.');
  console.log('Admin login: admin@example.com / admin1234');
  console.log('Cashier login: cashier@example.com / cashier12');
  console.log('Manager login: manager@example.com / manager12');
  console.log('Warehouse login: warehouse@example.com / warehouse12');
  console.log('Online login: online@example.com / online1234');
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

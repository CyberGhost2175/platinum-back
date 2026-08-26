import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ALL_ENTITIES } from './entities';
import { InitSchema20260825120000 } from './migrations/20260825120000-InitSchema';
import { AuthAndAudit20260825140000 } from './migrations/20260825140000-AuthAndAudit';
import { WarehouseModule20260825160000 } from './migrations/20260825160000-WarehouseModule';
import { OfflineSales20260825180000 } from './migrations/20260825180000-OfflineSales';
import { CatalogSearch20260825200000 } from './migrations/20260825200000-CatalogSearch';
import { AnalyticsModule20260825220000 } from './migrations/20260825220000-AnalyticsModule';
import { AdminDirectories20260825240000 } from './migrations/20260825240000-AdminDirectories';

export interface TypeOrmConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  logging: boolean;
}

function baseOptions(db: TypeOrmConnectionConfig): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    ssl: db.ssl ? { rejectUnauthorized: true } : false,
    entities: ALL_ENTITIES,
    migrations: [
      InitSchema20260825120000,
      AuthAndAudit20260825140000,
      WarehouseModule20260825160000,
      OfflineSales20260825180000,
      CatalogSearch20260825200000,
      AnalyticsModule20260825220000,
      AdminDirectories20260825240000,
    ],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: db.logging,
  };
}

export function typeOrmDataSourceOptions(
  db: TypeOrmConnectionConfig,
): DataSourceOptions {
  return baseOptions(db);
}

export function typeOrmModuleOptions(
  db: TypeOrmConnectionConfig,
): TypeOrmModuleOptions {
  return {
    ...baseOptions(db),
    autoLoadEntities: true,
    migrationsRun: true,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

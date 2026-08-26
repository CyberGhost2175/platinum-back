import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LocationsModule } from './locations/locations.module';
import { typeOrmModuleOptions } from './database/typeorm.config';
import { Env, validateEnv } from './config/env.validation';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { ShiftsModule } from './shifts/shifts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        typeOrmModuleOptions({
          host: config.get('DB_HOST', { infer: true }),
          port: config.get('DB_PORT', { infer: true }),
          username: config.get('DB_USERNAME', { infer: true }),
          password: config.get('DB_PASSWORD', { infer: true }),
          database: config.get('DB_DATABASE', { infer: true }),
          ssl: config.get('DB_SSL', { infer: true }),
          logging: config.get('DB_LOGGING', { infer: true }),
        }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
    CommonModule,
    HealthModule,
    AuthModule,
    AuditModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
    ShiftsModule,
    OrdersModule,
    CustomersModule,
    CatalogModule,
    LocationsModule,
    AnalyticsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}

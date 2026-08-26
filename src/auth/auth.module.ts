import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Env } from '../config/env.validation';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LocationGuard } from '../common/guards/location.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditModule } from '../audit/audit.module';
import { LocationsModule } from '../locations/locations.module';
import { ProductsModule } from '../products/products.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => UsersModule),
    LocationsModule,
    ProductsModule,
    ShiftsModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ProfileService,
    TokenService,
    TotpService,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: LocationGuard,
    },
  ],
  exports: [AuthService, TokenService, TotpService],
})
export class AuthModule {}

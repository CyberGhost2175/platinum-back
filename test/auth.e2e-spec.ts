import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Controller, Get, Query } from '@nestjs/common';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { TokenService } from '../src/auth/token.service';
import { TotpService } from '../src/auth/totp.service';
import { REDIS_CLIENT } from '../src/common/redis/redis.constants';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { LocationGuard } from '../src/common/guards/location.guard';
import { LocationsService } from '../src/locations/locations.service';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Roles } from '../src/common/decorators/roles.decorator';
import { RequireLocation } from '../src/common/decorators/require-location.decorator';
import { UserRole } from '../src/common/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/entities/user.entity';
import { validateEnv } from '../src/config/env.validation';

@Controller('probe')
class ProbeController {
  @Get('protected')
  protected() {
    return { ok: true };
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  adminOnly() {
    return { ok: true };
  }

  @Get('location')
  @RequireLocation()
  locationScoped(@Query('locationId') locationId: string) {
    return { ok: true, locationId };
  }
}

function memoryRedis() {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    get: async (key: string) => kv.get(key) ?? null,
    set: async (key: string, value: string) => {
      kv.set(key, value);
      return 'OK';
    },
    del: async (...keys: string[]) => {
      keys.flat().forEach((key) => {
        kv.delete(key);
        sets.delete(key);
      });
      return keys.length;
    },
    sadd: async (key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return 1;
    },
    srem: async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return 1;
    },
    smembers: async (key: string) => [...(sets.get(key) ?? [])],
    expire: async () => 1,
  };
}

const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: 8080,
  API_PREFIX: 'api',
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USERNAME: 'platinum',
  DB_PASSWORD: 'platinum',
  DB_DATABASE: 'platinum',
  DB_SYNCHRONIZE: 'false',
  DB_LOGGING: 'false',
  DB_SSL: 'false',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_DB: 0,
  SESSION_SECRET: 'test-session-secret-key',
  SESSION_NAME: 'test.sid',
  SESSION_TTL_SECONDS: 3600,
  CORS_ORIGINS: 'http://localhost:3000',
  THROTTLE_TTL_MS: 60000,
  THROTTLE_LIMIT: 1000,
  JWT_ACCESS_SECRET: 'test-access-secret-key',
  JWT_REFRESH_SECRET: 'test-refresh-secret-key',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 3600,
  PASSWORD_RESET_TTL_SECONDS: 900,
  TOTP_ISSUER: 'Platinum Test',
  AUTH_2FA_ENABLED: 'false',
};

describe('Auth e2e', () => {
  let app: INestApplication;
  const storeId = '11111111-1111-4111-8111-111111111111';
  const otherStoreId = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    const cashierHash = await hash('cashier12', 10);
    const managerHash = await hash('manager12', 10);
    const users: Record<string, User> = {
      'cashier@example.com': {
        id: 'cashier-id',
        email: 'cashier@example.com',
        passwordHash: cashierHash,
        status: UserStatus.ACTIVE,
        role: UserRole.CASHIER,
        totpEnabled: false,
        totpSecret: null,
        locationId: storeId,
        firstName: 'A',
        lastName: 'Cashier',
      } as User,
      'manager@example.com': {
        id: 'manager-id',
        email: 'manager@example.com',
        passwordHash: managerHash,
        status: UserStatus.ACTIVE,
        role: UserRole.STORE_MANAGER,
        totpEnabled: false,
        totpSecret: null,
        locationId: storeId,
        firstName: 'I',
        lastName: 'Manager',
      } as User,
    };

    const usersService = {
      findByEmailForAuth: jest.fn(async (email: string) => users[email] ?? null),
      findByEmailForAuthById: jest.fn(async (id: string) =>
        Object.values(users).find((user) => user.id === id) ?? null,
      ),
      findByEmail: jest.fn(async (email: string) => users[email] ?? null),
      findById: jest.fn(async (id: string) =>
        Object.values(users).find((user) => user.id === id) ?? null,
      ),
      create: jest.fn(),
      updateTotp: jest.fn(async (id: string, secret: string, enabled: boolean) => {
        const user = Object.values(users).find((item) => item.id === id);
        if (user) {
          user.totpSecret = secret;
          user.totpEnabled = enabled;
        }
      }),
      getOrFail: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (config) => validateEnv({ ...TEST_ENV, ...config }),
          load: [() => TEST_ENV],
        }),
        JwtModule.register({
          secret: 'test-access-secret-key',
          signOptions: { expiresIn: 900 },
        }),
      ],
      controllers: [AuthController, ProbeController],
      providers: [
        AuthService,
        TokenService,
        TotpService,
        JwtAuthGuard,
        { provide: UsersService, useValue: usersService },
        {
          provide: LocationsService,
          useValue: {
            isAccessible: async (
              user: { role: UserRole; locationId: string | null },
              locationId: string,
            ) =>
              user.role === UserRole.ADMIN ||
              user.role === UserRole.WAREHOUSE ||
              user.locationId === locationId,
          },
        },
        { provide: REDIS_CLIENT, useValue: memoryRedis() },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_GUARD, useClass: LocationGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@example.com', password: 'wrongpass' })
      .expect(401);
  });

  it('logs in with a valid password and returns JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@example.com', password: 'cashier12' })
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects access without a token', async () => {
    await request(app.getHttpServer()).get('/api/probe/protected').expect(401);
  });

  it('returns 403 when the role is insufficient', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@example.com', password: 'cashier12' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/probe/admin')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('returns 403 when accessing another sales location', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'manager@example.com', password: 'manager12' })
      .expect(200);

    expect(login.body.status).toBe('ok');
    expect(login.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/probe/location')
      .query({ locationId: otherStoreId })
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/probe/location')
      .query({ locationId: storeId })
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });
});

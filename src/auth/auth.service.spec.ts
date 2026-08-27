import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { Env } from '../config/env.validation';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { User } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmailForAuth' | 'findByEmail' | 'create' | 'update'>
  >;
  let profile: { build: jest.Mock };
  let tokenService: jest.Mocked<Pick<TokenService, 'issueTokenPair' | 'toAuthUser' | 'saveTotpChallenge'>>;
  let totpService: jest.Mocked<Pick<TotpService, 'generate'>>;

  const tokens = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 900,
  };

  beforeEach(async () => {
    usersService = {
      findByEmailForAuth: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    profile = {
      build: jest.fn(),
    };
    tokenService = {
      issueTokenPair: jest.fn().mockResolvedValue(tokens),
      toAuthUser: jest.fn((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
      })),
      saveTotpChallenge: jest.fn(),
    };
    totpService = {
      generate: jest.fn().mockReturnValue({
        secret: 'SECRET',
        otpauthUrl: 'otpauth://totp/test',
      }),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      tokenService as unknown as TokenService,
      totpService as unknown as TotpService,
      {
        get: (key: string) => (key === 'AUTH_2FA_ENABLED' ? false : 'test'),
      } as unknown as ConfigService<Env, true>,
      profile as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('logs in a cashier with the correct password', async () => {
    const passwordHash = await hash('cashier12', 10);
    const user = {
      id: 'u1',
      email: 'cashier@example.com',
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.CASHIER,
      totpEnabled: false,
      totpSecret: null,
      locationId: 'loc-1',
    } as User;
    usersService.findByEmailForAuth.mockResolvedValue(user);

    const result = await service.login({
      email: 'cashier@example.com',
      password: 'cashier12',
    });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.accessToken).toBe('access');
      expect(result.user.email).toBe('cashier@example.com');
    }
    expect(tokenService.issueTokenPair).toHaveBeenCalledWith(user);
  });

  it('rejects login with a wrong password', async () => {
    const passwordHash = await hash('cashier12', 10);
    usersService.findByEmailForAuth.mockResolvedValue({
      id: 'u1',
      email: 'cashier@example.com',
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.CASHIER,
      totpEnabled: false,
      totpSecret: null,
      locationId: 'loc-1',
    } as User);

    await expect(
      service.login({ email: 'cashier@example.com', password: 'wrongpass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
  });

  it('issues tokens for admin without 2FA while AUTH_2FA_ENABLED is off', async () => {
    const passwordHash = await hash('admin1234', 10);
    usersService.findByEmailForAuth.mockResolvedValue({
      id: 'admin',
      email: 'admin@example.com',
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
      totpEnabled: false,
      totpSecret: null,
      locationId: 'loc-1',
    } as User);

    const result = await service.login({
      email: 'admin@example.com',
      password: 'admin1234',
    });

    expect(result.status).toBe('ok');
    expect(tokenService.issueTokenPair).toHaveBeenCalled();
  });

  it('updates own profile fields', async () => {
    const me = { id: 'u1', firstName: 'Anna', lastName: 'Ivanova' };
    usersService.update.mockResolvedValue({} as never);
    profile.build.mockResolvedValue(me);

    const result = await service.updateProfile('u1', UserRole.CASHIER, {
      firstName: 'Anna',
      lastName: 'Ivanova',
      phone: '+77001112233',
    });

    expect(usersService.update).toHaveBeenCalledWith('u1', {
      firstName: 'Anna',
      lastName: 'Ivanova',
      email: undefined,
      phone: '+77001112233',
      locationId: undefined,
    });
    expect(result).toBe(me);
  });

  it('lets an admin change their sales location', async () => {
    profile.build.mockResolvedValue({ id: 'admin', locationId: 'loc-2' });
    usersService.update.mockResolvedValue({} as never);

    await service.updateProfile('admin', UserRole.ADMIN, { locationId: 'loc-2' });

    expect(usersService.update).toHaveBeenCalledWith(
      'admin',
      expect.objectContaining({ locationId: 'loc-2' }),
    );
  });

  it('forbids a cashier from changing their sales location', async () => {
    await expect(
      service.updateProfile('u1', UserRole.CASHIER, { locationId: 'loc-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(usersService.update).not.toHaveBeenCalled();
  });
});

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Env } from '../../config/env.validation';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWithAuth(header?: string): ExecutionContext {
  const request = {
    headers: header ? { authorization: header } : {},
    user: undefined,
  };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const config = {
    get: jest.fn().mockReturnValue('secret'),
  } as unknown as ConfigService<Env, true>;
  const redis = { get: jest.fn().mockResolvedValue(null) };

  const guard = new JwtAuthGuard(
    reflector,
    jwtService,
    config,
    redis as never,
  );

  it('rejects a request without a bearer token', async () => {
    await expect(guard.canActivate(contextWithAuth())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a valid access token', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      typ: 'access',
      sub: 'u1',
      email: 'a@b.c',
      role: 'cashier',
      locationId: 'loc',
      iat: Math.floor(Date.now() / 1000),
    });
    await expect(
      guard.canActivate(contextWithAuth('Bearer valid.token')),
    ).resolves.toBe(true);
  });
});

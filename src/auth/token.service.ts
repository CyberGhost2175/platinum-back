import { randomUUID } from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Env } from '../config/env.validation';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { User } from '../users/entities/user.entity';
import {
  AuthUser,
  RefreshTokenPayload,
  TokenPair,
  TotpChallenge,
} from './types/auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  toAuthUser(user: Pick<User, 'id' | 'email' | 'role' | 'locationId'>): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId ?? null,
    };
  }

  async issueTokenPair(user: User): Promise<TokenPair> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL_SECONDS', {
      infer: true,
    });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL_SECONDS', {
      infer: true,
    });
    const authUser = this.toAuthUser(user);
    const jti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          locationId: user.locationId,
          typ: 'access',
        },
        {
          secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
          expiresIn: accessTtl,
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id, jti, typ: 'refresh' },
        {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
          expiresIn: refreshTtl,
        },
      ),
    ]);

    await this.redis.set(
      this.refreshKey(jti),
      JSON.stringify({ userId: user.id }),
      'EX',
      refreshTtl,
    );
    await this.redis.sadd(this.userRefreshKey(user.id), jti);
    await this.redis.expire(this.userRefreshKey(user.id), refreshTtl);

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async rotateRefreshToken(refreshToken: string, user: User): Promise<TokenPair> {
    const payload = await this.verifyRefresh(refreshToken);
    await this.revokeRefresh(payload.jti, payload.sub);
    return this.issueTokenPair(user);
  }

  async verifyRefresh(refreshToken: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        { secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }) },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh' || !payload.jti || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const stored = await this.redis.get(this.refreshKey(payload.jti));
    if (!stored) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    return payload;
  }

  async revokeRefresh(jti: string, userId: string): Promise<void> {
    await this.redis.del(this.refreshKey(jti));
    await this.redis.srem(this.userRefreshKey(userId), jti);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const jtis = await this.redis.smembers(this.userRefreshKey(userId));
    if (jtis.length > 0) {
      await this.redis.del(
        ...jtis.map((jti) => this.refreshKey(jti)),
        this.userRefreshKey(userId),
      );
    } else {
      await this.redis.del(this.userRefreshKey(userId));
    }
    await this.redis.set(`auth:revoke:${userId}`, String(Date.now()));
  }

  async saveTotpChallenge(
    challengeId: string,
    challenge: TotpChallenge,
    ttlSeconds = 300,
  ): Promise<void> {
    await this.redis.set(
      this.challengeKey(challengeId),
      JSON.stringify(challenge),
      'EX',
      ttlSeconds,
    );
  }

  async takeTotpChallenge(challengeId: string): Promise<TotpChallenge | null> {
    const raw = await this.redis.get(this.challengeKey(challengeId));
    if (!raw) {
      return null;
    }
    await this.redis.del(this.challengeKey(challengeId));
    return JSON.parse(raw) as TotpChallenge;
  }

  async savePasswordReset(
    token: string,
    userId: string,
  ): Promise<void> {
    const ttl = this.config.get('PASSWORD_RESET_TTL_SECONDS', { infer: true });
    await this.redis.set(this.resetKey(token), userId, 'EX', ttl);
  }

  async takePasswordReset(token: string): Promise<string | null> {
    const userId = await this.redis.get(this.resetKey(token));
    if (!userId) {
      return null;
    }
    await this.redis.del(this.resetKey(token));
    return userId;
  }

  private refreshKey(jti: string): string {
    return `auth:refresh:${jti}`;
  }

  private userRefreshKey(userId: string): string {
    return `auth:refresh-user:${userId}`;
  }

  private challengeKey(id: string): string {
    return `auth:2fa:${id}`;
  }

  private resetKey(token: string): string {
    return `auth:reset:${token}`;
  }
}

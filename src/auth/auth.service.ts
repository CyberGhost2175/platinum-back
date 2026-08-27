import { randomBytes, randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { totpRequiredFor } from '../common/constants/permissions';
import { UserRole } from '../common/enums/user-role.enum';
import { Env } from '../config/env.validation';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ProfileService } from './profile.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthUser, LoginResult, TokenPair } from './types/auth.types';

export type AuthEventMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly totpService: TotpService,
    private readonly config: ConfigService<Env, true>,
    private readonly profile: ProfileService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair & { user: AuthUser }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: UserRole.CASHIER,
    });
    const full = await this.usersService.findByEmailForAuth(user.email);
    if (!full) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.tokenService.issueTokenPair(full);
    return { ...tokens, user: this.tokenService.toAuthUser(full) };
  }

  async login(dto: LoginDto, meta: AuthEventMeta = {}): Promise<LoginResult> {
    const user = await this.usersService.findByEmailForAuth(dto.email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.isTwoFactorEnabled()) {
      const requiresTotp = totpRequiredFor(user.role) || user.totpEnabled;
      if (requiresTotp && user.totpEnabled && user.totpSecret) {
        const challengeId = randomUUID();
        await this.tokenService.saveTotpChallenge(challengeId, {
          userId: user.id,
          purpose: 'verify',
        });
        return { status: 'totp_required', challengeId };
      }

      if (totpRequiredFor(user.role) && !user.totpEnabled) {
        const generated = this.totpService.generate(user.email);
        const challengeId = randomUUID();
        await this.tokenService.saveTotpChallenge(challengeId, {
          userId: user.id,
          purpose: 'enroll',
          secret: generated.secret,
        });
        return {
          status: 'totp_enrollment',
          challengeId,
          otpauthUrl: generated.otpauthUrl,
          secret: generated.secret,
        };
      }
    }

    const tokens = await this.tokenService.issueTokenPair(user);
    await this.recordAuthEvent(user, 'login', meta);
    return {
      status: 'ok',
      ...tokens,
      user: this.tokenService.toAuthUser(user),
    };
  }

  async confirmTwoFactor(
    challengeId: string,
    code: string,
    meta: AuthEventMeta = {},
  ): Promise<TokenPair & { user: AuthUser }> {
    this.assertTwoFactorEnabled();
    const challenge = await this.tokenService.takeTotpChallenge(challengeId);
    if (!challenge) {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }
    const user = await this.usersService.findByEmailForAuthById(challenge.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (challenge.purpose === 'enroll') {
      if (!challenge.secret || !this.totpService.verify(challenge.secret, code)) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
      await this.usersService.updateTotp(user.id, challenge.secret, true);
      user.totpEnabled = true;
      user.totpSecret = challenge.secret;
    } else {
      if (!user.totpSecret || !this.totpService.verify(user.totpSecret, code)) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    const tokens = await this.tokenService.issueTokenPair(user);
    await this.recordAuthEvent(user, 'login', meta);
    return { ...tokens, user: this.tokenService.toAuthUser(user) };
  }

  async setupTotp(userId: string) {
    this.assertTwoFactorEnabled();
    const user = await this.usersService.getOrFail(userId);
    const generated = this.totpService.generate(user.email);
    const challengeId = randomUUID();
    await this.tokenService.saveTotpChallenge(challengeId, {
      userId,
      purpose: 'enroll',
      secret: generated.secret,
    });
    return {
      challengeId,
      secret: generated.secret,
      otpauthUrl: generated.otpauthUrl,
    };
  }

  async enableTotp(userId: string, challengeId: string, code: string) {
    this.assertTwoFactorEnabled();
    const challenge = await this.tokenService.takeTotpChallenge(challengeId);
    if (!challenge || challenge.userId !== userId || challenge.purpose !== 'enroll') {
      throw new BadRequestException('Invalid 2FA setup challenge');
    }
    if (!challenge.secret || !this.totpService.verify(challenge.secret, code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.usersService.updateTotp(userId, challenge.secret, true);
    return { totpEnabled: true };
  }

  async disableTotp(userId: string, code: string) {
    const user = await this.usersService.findByEmailForAuthById(userId);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (totpRequiredFor(user.role)) {
      throw new ForbiddenException('2FA is required for this role');
    }
    if (!user.totpSecret || !this.totpService.verify(user.totpSecret, code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.usersService.updateTotp(userId, null, false);
    return { totpEnabled: false };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.tokenService.verifyRefresh(refreshToken);
    const user = await this.usersService.findByEmailForAuthById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.tokenService.rotateRefreshToken(refreshToken, user);
  }

  async logout(refreshToken: string, meta: AuthEventMeta = {}): Promise<void> {
    try {
      const payload = await this.tokenService.verifyRefresh(refreshToken);
      await this.tokenService.revokeRefresh(payload.jti, payload.sub);
      const user = await this.usersService.findByEmailForAuthById(payload.sub);
      if (user) {
        await this.recordAuthEvent(user, 'logout', meta);
      }
    } catch {
      return;
    }
  }

  async logoutAll(userId: string, meta: AuthEventMeta = {}): Promise<void> {
    await this.tokenService.revokeAllSessions(userId);
    const user = await this.usersService.findByEmailForAuthById(userId);
    if (user) {
      await this.recordAuthEvent(user, 'logout', meta);
    }
  }

  loginHistory(userId: string) {
    return this.audit.findAuthHistory(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const response: { message: string; devToken?: string } = {
      message: 'If the email exists, a reset code was sent',
    };
    if (!user || user.status !== UserStatus.ACTIVE) {
      return response;
    }
    const token = randomBytes(24).toString('hex');
    await this.tokenService.savePasswordReset(token, user.id);
    const env = this.config.get('NODE_ENV', { infer: true });
    if (env !== 'production') {
      this.logger.warn(`Password reset token for ${user.email}: ${token}`);
      response.devToken = token;
    }
    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.tokenService.takePasswordReset(dto.token);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.changePassword(userId, dto.password);
  }

  async changePassword(userId: string, password: string): Promise<void> {
    await this.usersService.setPassword(userId, password);
    await this.tokenService.revokeAllSessions(userId);
  }

  async me(userId: string) {
    return this.profile.build(userId);
  }

  async updateProfile(userId: string, role: UserRole, dto: UpdateProfileDto) {
    if (dto.locationId !== undefined && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only an admin can change their sales location');
    }
    await this.usersService.update(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      locationId: role === UserRole.ADMIN ? dto.locationId : undefined,
    });
    return this.profile.build(userId);
  }

  private isTwoFactorEnabled(): boolean {
    return this.config.get('AUTH_2FA_ENABLED', { infer: true });
  }

  private assertTwoFactorEnabled(): void {
    if (!this.isTwoFactorEnabled()) {
      throw new BadRequestException('2FA is temporarily disabled');
    }
  }

  private async recordAuthEvent(
    user: Pick<User, 'id' | 'role'>,
    action: 'login' | 'logout',
    meta: AuthEventMeta,
  ): Promise<void> {
    try {
      await this.audit.write({
        userId: user.id,
        role: user.role,
        action,
        resource: 'auth',
        method: action === 'login' ? 'POST' : 'POST',
        path: action === 'login' ? '/api/auth/login' : '/api/auth/logout',
        payload: {
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.stack : error,
        'Failed to write auth history',
      );
    }
  }
}

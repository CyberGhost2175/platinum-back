import { UserRole } from '../../common/enums/user-role.enum';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  locationId: string | null;
}

export interface AccessTokenPayload extends AuthUser {
  sub: string;
  typ: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
  iat?: number;
  exp?: number;
}

export type TotpChallengePurpose = 'verify' | 'enroll';

export interface TotpChallenge {
  userId: string;
  purpose: TotpChallengePurpose;
  secret?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type LoginResult =
  | ({ status: 'ok' } & TokenPair & { user: AuthUser })
  | { status: 'totp_required'; challengeId: string }
  | {
      status: 'totp_enrollment';
      challengeId: string;
      otpauthUrl: string;
      secret: string;
    };

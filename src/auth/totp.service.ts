import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import { Env } from '../config/env.validation';

@Injectable()
export class TotpService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  generate(email: string) {
    const issuer = this.config.get('TOTP_ISSUER', { infer: true });
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${email})`,
      issuer,
      length: 20,
    });
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url ?? '',
    };
  }

  verify(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }
}
